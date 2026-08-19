<?php
declare(strict_types=1);

const GENERIC_ERROR_MESSAGE = "Sorry, something went wrong on our end and we couldn't save your review. Please try again shortly.";

$fileEnv = load_env_files();
apply_cors($fileEnv);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

json_header();

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'GET') {
    handle_list();
} elseif ($method === 'POST') {
    handle_submit($fileEnv);
} else {
    respond_json(405, ['success' => false, 'message' => 'Method not allowed.']);
}

function handle_list(): void
{
    $reviews = with_reviews_store(LOCK_SH, static function (array $reviews) {
        return [null, array_map('to_public_review', $reviews)];
    });
    respond_json(200, ['success' => true, 'reviews' => $reviews]);
}

function handle_submit(array $fileEnv): void
{
    $payload = read_json_payload();

    if (is_honeypot_triggered($payload)) {
        respond_json(200, ['success' => true, 'message' => 'Thanks for your review!']);
    }

    $config = build_rate_limit_config($fileEnv);
    enforce_rate_limit($config);

    [$review, $errors] = validate_review($payload);
    if ($errors) {
        respond_json(400, [
            'success' => false,
            'message' => 'Please check the highlighted fields and try again.',
            'errors' => $errors,
        ]);
    }

    try {
        $result = with_reviews_store(LOCK_EX, static function (array $reviews) use ($review) {
            return upsert_review($reviews, $review);
        });
    } catch (Throwable $err) {
        error_log('Review submission failed: ' . safe_error($err));
        respond_json(502, ['success' => false, 'message' => GENERIC_ERROR_MESSAGE]);
        return;
    }

    respond_json(200, [
        'success' => true,
        'isNew' => $result['isNew'],
        'review' => to_public_review($result['review']),
        'message' => $result['isNew'] ? "Thanks for your review! It's now live below." : 'Your review has been updated.',
    ]);
}

/**
 * Opens the JSON store, takes the given lock (LOCK_SH for reads, LOCK_EX for
 * read-modify-write), hands the decoded array to $fn, and — if $fn returns a
 * non-null array as its first element — persists that back before releasing
 * the lock. Returns $fn's second element to the caller.
 */
function with_reviews_store(int $lockType, callable $fn)
{
    $path = reviews_data_path();
    $handle = fopen($path, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Unable to open reviews store.');
    }

    try {
        flock($handle, $lockType);
        $contents = stream_get_contents($handle);
        $reviews = json_decode($contents ?: '[]', true);
        if (!is_array($reviews)) {
            $reviews = [];
        }

        [$updated, $returnValue] = $fn($reviews);

        if ($updated !== null) {
            $tmpPath = $path . '.' . getmypid() . '.' . microtime(true) . '.tmp';
            if (file_put_contents($tmpPath, json_encode($updated, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)) === false) {
                throw new RuntimeException('Unable to write reviews store.');
            }
            rename($tmpPath, $path);
        }

        return $returnValue;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function reviews_data_path(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('Unable to create reviews data directory.');
    }
    return $dir . '/reviews.json';
}

/** Never expose the stored email — it exists only as the per-account upsert key. */
function to_public_review(array $review): array
{
    return [
        'id' => $review['id'],
        'name' => $review['name'],
        'rating' => $review['rating'],
        'text' => $review['text'],
        'createdAt' => $review['createdAt'],
        'updatedAt' => $review['updatedAt'],
    ];
}

/** @return array{0: array|null, 1: array{review: array, isNew: bool}} */
function upsert_review(array $reviews, array $input): array
{
    $emailKey = strtolower($input['email']);
    $now = gmdate('c');
    $existingIndex = null;
    foreach ($reviews as $index => $existing) {
        if (strtolower($existing['email'] ?? '') === $emailKey) {
            $existingIndex = $index;
            break;
        }
    }

    if ($existingIndex === null) {
        $review = [
            'id' => bin2hex(random_bytes(16)),
            'name' => $input['name'],
            'email' => $emailKey,
            'rating' => $input['rating'],
            'text' => $input['text'],
            'createdAt' => $now,
            'updatedAt' => $now,
        ];
        $reviews[] = $review;
        $isNew = true;
    } else {
        $review = $reviews[$existingIndex];
        $review['name'] = $input['name'];
        $review['rating'] = $input['rating'];
        $review['text'] = $input['text'];
        $review['updatedAt'] = $now;
        $reviews[$existingIndex] = $review;
        $isNew = false;
    }

    return [$reviews, ['review' => $review, 'isNew' => $isNew]];
}

function validate_review(array $payload): array
{
    $review = [
        'name' => sanitize_single_line($payload['name'] ?? ''),
        'email' => strtolower(sanitize_single_line($payload['email'] ?? '')),
        'rating' => filter_var($payload['rating'] ?? null, FILTER_VALIDATE_INT),
        'text' => sanitize_notes($payload['text'] ?? ''),
    ];

    $errors = [];
    if (strlen($review['name']) < 2 || strlen($review['name']) > 100) {
        $errors[] = ['field' => 'name', 'message' => 'Please enter your name (2-100 characters).'];
    }

    if (!filter_var($review['email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = ['field' => 'email', 'message' => 'Please enter a valid email address - it identifies your review so you can edit it later.'];
    }

    if ($review['rating'] === false || $review['rating'] === null || $review['rating'] < 1 || $review['rating'] > 5) {
        $errors[] = ['field' => 'rating', 'message' => 'Please choose a rating from 1 to 5 stars.'];
    }

    $textLength = strlen($review['text']);
    if ($textLength < 10 || $textLength > 1000) {
        $errors[] = ['field' => 'text', 'message' => 'Reviews must be between 10 and 1000 characters.'];
    }

    return [$review, $errors ? $errors : null];
}

function is_honeypot_triggered(array $payload): bool
{
    return isset($payload['website']) && trim((string) $payload['website']) !== '';
}

function build_rate_limit_config(array $fileEnv): array
{
    return [
        'rateLimitWindowMinutes' => max(1, (int) (env_value($fileEnv, 'RATE_LIMIT_WINDOW_MINUTES', '15') ?? '15')),
        'rateLimitMax' => max(1, (int) (env_value($fileEnv, 'RATE_LIMIT_MAX', '5') ?? '5')),
    ];
}

function enforce_rate_limit(array $config): void
{
    $ip = client_ip();
    $windowSeconds = $config['rateLimitWindowMinutes'] * 60;
    $now = time();
    $bucketDir = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'toolsonthewheels-rate-limit';

    if (!is_dir($bucketDir) && !mkdir($bucketDir, 0700, true) && !is_dir($bucketDir)) {
        return;
    }

    // Separate bucket namespace ("reviews-") so this limiter doesn't share a budget with the booking form's.
    $bucketFile = $bucketDir . DIRECTORY_SEPARATOR . 'reviews-' . hash('sha256', $ip) . '.json';
    $handle = fopen($bucketFile, 'c+');
    if ($handle === false) {
        return;
    }

    try {
        flock($handle, LOCK_EX);
        $contents = stream_get_contents($handle);
        $attempts = json_decode($contents ?: '[]', true);
        if (!is_array($attempts)) {
            $attempts = [];
        }

        $attempts = array_values(array_filter($attempts, static function ($timestamp) use ($now, $windowSeconds) {
            return is_int($timestamp) && $timestamp > $now - $windowSeconds;
        }));

        if (count($attempts) >= $config['rateLimitMax']) {
            flock($handle, LOCK_UN);
            fclose($handle);
            respond_json(429, [
                'success' => false,
                'message' => 'Too many requests. Please wait a few minutes before trying again.',
            ]);
        }

        $attempts[] = $now;
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($attempts));
        fflush($handle);
        flock($handle, LOCK_UN);
    } finally {
        if (is_resource($handle)) {
            fclose($handle);
        }
    }
}

function client_ip(): string
{
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        return $_SERVER['HTTP_CF_CONNECTING_IP'];
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($parts[0]);
    }
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

function sanitize_single_line($value): string
{
    return trim(preg_replace('/[\x00-\x1F\x7F]/', '', (string) $value));
}

function sanitize_notes($value): string
{
    return trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', (string) $value));
}

function load_env_files(): array
{
    $root = dirname(__DIR__);
    $env = [];
    foreach ([$root . '/server/.env', $root . '/.env', __DIR__ . '/.env'] as $path) {
        if (!is_readable($path)) {
            continue;
        }
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            continue;
        }
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            if ($key === '') {
                continue;
            }
            $env[$key] = parse_env_value(trim($value));
        }
    }
    return $env;
}

function parse_env_value(string $value): string
{
    if ($value === '') {
        return '';
    }
    $first = $value[0];
    $last = $value[strlen($value) - 1];
    if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
        $value = substr($value, 1, -1);
        if ($first === '"') {
            $value = str_replace(['\\n', '\\r', '\\"', '\\\\'], ["\n", "\r", '"', '\\'], $value);
        }
    }
    return $value;
}

function env_value(array $fileEnv, string $key, ?string $default = null): ?string
{
    $value = getenv($key);
    if ($value !== false && trim($value) !== '') {
        return $value;
    }
    if (array_key_exists($key, $fileEnv) && trim($fileEnv[$key]) !== '') {
        return $fileEnv[$key];
    }
    return $default;
}

function apply_cors(array $fileEnv): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return;
    }

    $configured = env_value($fileEnv, 'CORS_ORIGIN', 'https://toolsonthewheels.com,https://www.toolsonthewheels.com') ?? '';
    if ($configured === '*') {
        header('Access-Control-Allow-Origin: *');
    } else {
        $allowed = array_filter(array_map('trim', explode(',', $configured)));
        if (in_array($origin, $allowed, true) || ($origin === 'null' && has_loopback_origin($allowed))) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
        }
    }

    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Max-Age: 86400');
}

function has_loopback_origin(array $origins): bool
{
    foreach ($origins as $origin) {
        if (preg_match('/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/', $origin)) {
            return true;
        }
    }
    return false;
}

function json_header(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
}

function respond_json(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json_payload(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 20000) {
        respond_json(400, ['success' => false, 'message' => 'Malformed request body.']);
    }

    $payload = json_decode($raw, true);
    if (!is_array($payload) || json_last_error() !== JSON_ERROR_NONE) {
        respond_json(400, ['success' => false, 'message' => 'Malformed request body.']);
    }

    return $payload;
}

function safe_error(Throwable $err): string
{
    return $err->getMessage() . ' [' . get_class($err) . ']';
}
