<?php
declare(strict_types=1);

const GENERIC_ERROR_MESSAGE = "Sorry, something went wrong on our end and we couldn't submit your request. Please try again shortly, or call/text us directly.";
const SUCCESS_WITH_CONFIRMATION = "Thanks! Your consultation request has been received - we'll be in touch shortly to confirm, and a confirmation email is on its way to you.";
const SUCCESS_WITHOUT_CONFIRMATION = "Thanks! Your consultation request has been received - we'll be in touch shortly to confirm.";

$fileEnv = load_env_files();
apply_cors($fileEnv);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

json_header();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_json(405, ['success' => false, 'message' => 'Method not allowed.']);
}

$payload = read_json_payload();

if (is_honeypot_triggered($payload)) {
    respond_json(200, ['success' => true, 'message' => SUCCESS_WITHOUT_CONFIRMATION]);
}

$config = build_config($fileEnv);
enforce_rate_limit($config);

[$booking, $errors] = validate_booking($payload, $config);
if ($errors) {
    respond_json(400, [
        'success' => false,
        'message' => 'Please check the highlighted fields and try again.',
        'errors' => $errors,
    ]);
}

try {
    send_owner_notification($booking, $config);

    $confirmationSent = true;
    try {
        send_customer_confirmation($booking, $config);
    } catch (Throwable $err) {
        $confirmationSent = false;
        error_log('Customer confirmation email failed: ' . safe_error($err));
    }

    respond_json(200, [
        'success' => true,
        'message' => $confirmationSent ? SUCCESS_WITH_CONFIRMATION : SUCCESS_WITHOUT_CONFIRMATION,
    ]);
} catch (Throwable $err) {
    error_log('Appointment booking failed: ' . safe_error($err));
    respond_json(502, ['success' => false, 'message' => GENERIC_ERROR_MESSAGE]);
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

    header('Access-Control-Allow-Methods: POST, OPTIONS');
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

function build_config(array $fileEnv): array
{
    $businessTimezone = env_value($fileEnv, 'BUSINESS_TIMEZONE', 'America/Toronto') ?? 'America/Toronto';
    try {
        $timezone = new DateTimeZone($businessTimezone);
    } catch (Throwable $err) {
        $timezone = new DateTimeZone('America/Toronto');
    }

    $ownerEmail = env_value($fileEnv, 'OWNER_EMAIL', 'toolsonthewheels@gmail.com') ?? 'toolsonthewheels@gmail.com';
    $emailFrom = env_value($fileEnv, 'EMAIL_FROM', 'Tools on the Wheels <toolsonthewheels@gmail.com>') ?? 'Tools on the Wheels <toolsonthewheels@gmail.com>';

    return [
        'ownerEmail' => trim($ownerEmail),
        'emailFrom' => trim($emailFrom),
        'businessName' => env_value($fileEnv, 'BUSINESS_NAME', 'Tools on the Wheels') ?? 'Tools on the Wheels',
        'businessPhone' => env_value($fileEnv, 'BUSINESS_PHONE', '+1 (514) 571-9041') ?? '+1 (514) 571-9041',
        'timezone' => $timezone,
        'rateLimitWindowMinutes' => max(1, (int) (env_value($fileEnv, 'RATE_LIMIT_WINDOW_MINUTES', '15') ?? '15')),
        'rateLimitMax' => max(1, (int) (env_value($fileEnv, 'RATE_LIMIT_MAX', '5') ?? '5')),
        // Shared hosting commonly provides PHP mail() but blocks outbound SMTP.
        // Use it by default; SMTP remains available when explicitly configured.
        'emailProvider' => strtolower(env_value($fileEnv, 'EMAIL_PROVIDER', 'mail') ?? 'mail'),
        'smtpHost' => env_value($fileEnv, 'SMTP_HOST', ''),
        'smtpPort' => (int) (env_value($fileEnv, 'SMTP_PORT', '587') ?? '587'),
        'smtpSecure' => strtolower(env_value($fileEnv, 'SMTP_SECURE', 'false') ?? 'false') === 'true',
        'smtpUser' => env_value($fileEnv, 'SMTP_USER', ''),
        'smtpPass' => env_value($fileEnv, 'SMTP_PASS', ''),
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

    $bucketFile = $bucketDir . DIRECTORY_SEPARATOR . hash('sha256', $ip) . '.json';
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

function is_honeypot_triggered(array $payload): bool
{
    return isset($payload['website']) && trim((string) $payload['website']) !== '';
}

function validate_booking(array $payload, array $config): array
{
    $booking = [
        'name' => sanitize_single_line($payload['name'] ?? ''),
        'phone' => sanitize_single_line($payload['phone'] ?? ''),
        'email' => sanitize_single_line($payload['email'] ?? ''),
        'service' => sanitize_single_line($payload['service'] ?? ''),
        'date' => sanitize_single_line($payload['date'] ?? ''),
        'time' => sanitize_single_line($payload['time'] ?? ''),
        'notes' => sanitize_notes($payload['notes'] ?? ''),
    ];

    $errors = [];
    if (strlen($booking['name']) < 2 || strlen($booking['name']) > 100) {
        $errors[] = ['field' => 'name', 'message' => 'Please enter your full name (2-100 characters).'];
    }

    if (!preg_match('/^[0-9+()\-. ]{7,20}$/', $booking['phone'])) {
        $errors[] = ['field' => 'phone', 'message' => 'Please enter a valid phone number.'];
    }

    if (!filter_var($booking['email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = ['field' => 'email', 'message' => 'Please enter a valid email address.'];
    }

    if (!in_array($booking['service'], service_options(), true)) {
        $errors[] = ['field' => 'service', 'message' => 'Please select a valid service from the list.'];
    }

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $booking['date']) || !is_valid_calendar_date($booking['date'])) {
        $errors[] = ['field' => 'date', 'message' => 'Please choose a valid preferred date.'];
    } else {
        $today = (new DateTimeImmutable('now', $config['timezone']))->format('Y-m-d');
        $maxFuture = (new DateTimeImmutable('now', $config['timezone']))->modify('+2 years')->format('Y-m-d');
        if ($booking['date'] < $today) {
            $errors[] = ['field' => 'date', 'message' => 'Preferred date cannot be in the past.'];
        } elseif ($booking['date'] > $maxFuture) {
            $errors[] = ['field' => 'date', 'message' => 'Preferred date is too far in the future.'];
        }
    }

    if (!in_array($booking['time'], time_options(), true)) {
        $errors[] = ['field' => 'time', 'message' => 'Please select a valid time slot.'];
    }

    if (strlen($booking['notes']) > 2000) {
        $errors[] = ['field' => 'notes', 'message' => 'Additional notes must be under 2000 characters.'];
    }

    return [$booking, $errors];
}

function service_options(): array
{
    return [
        'Paint Work',
        'Door Installation',
        'Window Finishing',
        'Kitchen Cabinets',
        'Drywall Installation',
        'Tiling',
        'Patch Work',
        'Plumbing Work',
        'Finishing (Baseboards & Trims)',
        'Flooring',
        'Basement Renovation',
        'Washroom Renovation',
        'Maintenance Services',
        'Multiple / Not sure',
    ];
}

function time_options(): array
{
    $dash = "\u{2013}";
    return [
        'Morning (8am ' . $dash . ' 12pm)',
        'Afternoon (12pm ' . $dash . ' 4pm)',
        'Evening (4pm ' . $dash . ' 7pm)',
        'No preference',
    ];
}

function sanitize_single_line($value): string
{
    return trim(preg_replace('/[\x00-\x1F\x7F]/', '', (string) $value));
}

function sanitize_notes($value): string
{
    return trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', (string) $value));
}

function is_valid_calendar_date(string $date): bool
{
    [$year, $month, $day] = array_map('intval', explode('-', $date));
    return checkdate($month, $day, $year);
}

function send_owner_notification(array $booking, array $config): void
{
    [$subject, $text, $html] = owner_template($booking, $config);
    send_mail_message($config, [
        'from' => $config['emailFrom'],
        'to' => $config['ownerEmail'],
        'subject' => $subject,
        'text' => $text,
        'html' => $html,
    ]);
}

function send_customer_confirmation(array $booking, array $config): void
{
    [$subject, $text, $html] = customer_template($booking, $config);
    send_mail_message($config, [
        'from' => $config['emailFrom'],
        'to' => $booking['email'],
        'subject' => $subject,
        'text' => $text,
        'html' => $html,
    ]);
}

function owner_template(array $booking, array $config): array
{
    $dash = "\u{2014}";
    $subject = 'New consultation request: ' . $booking['service'] . ' ' . $dash . ' ' . $booking['name'];
    $rows = [
        detail_row('Name', $booking['name']),
        detail_row('Phone', $booking['phone']),
        detail_row('Email', $booking['email']),
        detail_row('Service', $booking['service']),
        detail_row('Preferred date', $booking['date']),
        detail_row('Preferred time', $booking['time']),
    ];
    $notes = $booking['notes'] !== '' ? escape_html($booking['notes']) : '<span style="color:#9b8f78">None provided</span>';
    $bodyHtml = '
      <p style="margin:0 0 8px;font-size:18px;font-weight:bold;color:#cbaa6c;">New consultation request</p>
      <p style="margin:0 0 4px;color:#9b8f78;">A new booking came in through the website consultation form.</p>
      ' . details_table($rows) . '
      <p style="margin:18px 0 4px;color:#9b8f78;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Additional notes</p>
      <p style="margin:0;white-space:pre-wrap;">' . $notes . '</p>';
    $html = render_layout($config['businessName'], $subject, $bodyHtml);
    $text = implode("\n", [
        'New consultation request',
        '',
        'Name: ' . $booking['name'],
        'Phone: ' . $booking['phone'],
        'Email: ' . $booking['email'],
        'Service: ' . $booking['service'],
        'Preferred date: ' . $booking['date'],
        'Preferred time: ' . $booking['time'],
        '',
        'Additional notes:',
        $booking['notes'] !== '' ? $booking['notes'] : 'None provided',
    ]);
    return [$subject, $text, $html];
}

function customer_template(array $booking, array $config): array
{
    $dash = "\u{2014}";
    $subject = 'We received your consultation request ' . $dash . ' ' . $config['businessName'];
    $rows = [
        detail_row('Service', $booking['service']),
        detail_row('Preferred date', $booking['date']),
        detail_row('Preferred time', $booking['time']),
    ];
    $notes = $booking['notes'] !== '' ? escape_html($booking['notes']) : '<span style="color:#9b8f78">None provided</span>';
    $bodyHtml = '
      <p style="margin:0 0 8px;font-size:18px;font-weight:bold;color:#cbaa6c;">Thanks, ' . escape_html($booking['name']) . '!</p>
      <p style="margin:0 0 4px;">We\'ve received your consultation request and a member of our team will contact you shortly to confirm your appointment.</p>
      <p style="margin:12px 0 4px;color:#9b8f78;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Your request</p>
      ' . details_table($rows) . '
      <p style="margin:18px 0 4px;color:#9b8f78;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Project details</p>
      <p style="margin:0;white-space:pre-wrap;">' . $notes . '</p>
      <p style="margin:18px 0 0;color:#9b8f78;">Questions in the meantime? Call or text us at ' . escape_html($config['businessPhone']) . '.</p>';
    $html = render_layout($config['businessName'], $subject, $bodyHtml);
    $text = implode("\n", [
        'Thanks, ' . $booking['name'] . '!',
        '',
        "We've received your consultation request and a member of our team will contact you shortly to confirm your appointment.",
        '',
        'Your request:',
        'Service: ' . $booking['service'],
        'Preferred date: ' . $booking['date'],
        'Preferred time: ' . $booking['time'],
        '',
        'Project details:',
        $booking['notes'] !== '' ? $booking['notes'] : 'None provided',
        '',
        'Questions in the meantime? Call or text us at ' . $config['businessPhone'] . '.',
    ]);
    return [$subject, $text, $html];
}

function render_layout(string $businessName, string $title, string $bodyHtml): string
{
    return '<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . escape_html($title) . '</title></head>
<body style="margin:0;padding:0;background:#f4f1ec;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#0c0b09;border-radius:6px;overflow:hidden;">
        <tr><td style="padding:28px 32px;border-bottom:2px solid #cbaa6c;">
          <span style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#cbaa6c;font-weight:bold;">' . escape_html($businessName) . '</span>
        </td></tr>
        <tr><td style="padding:32px;color:#ece3d2;font-size:15px;line-height:1.6;">' . $bodyHtml . '</td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(203,170,108,.25);color:#9b8f78;font-size:12px;">
          This is an automated message from the ' . escape_html($businessName) . ' website booking form.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>';
}

function detail_row(string $label, string $value): string
{
    $displayValue = escape_html($value);
    if ($displayValue === '') {
        $displayValue = '-';
    }
    return '<tr>
      <td style="padding:6px 0;color:#9b8f78;font-size:13px;text-transform:uppercase;letter-spacing:1px;vertical-align:top;white-space:nowrap;padding-right:16px;">' . escape_html($label) . '</td>
      <td style="padding:6px 0;color:#ece3d2;font-size:15px;">' . $displayValue . '</td>
    </tr>';
}

function details_table(array $rows): string
{
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">' . implode('', $rows) . '</table>';
}

function send_mail_message(array $config, array $message): void
{
    if ($config['emailProvider'] === 'smtp') {
        if (!$config['smtpHost'] || !$config['smtpUser'] || !$config['smtpPass']) {
            throw new RuntimeException('SMTP configuration is incomplete.');
        }
        smtp_send($config, $message);
        return;
    }

    if ($config['emailProvider'] === 'mail') {
        native_mail_send($message);
        return;
    }

    throw new RuntimeException('Unsupported PHP email provider.');
}

function native_mail_send(array $message): void
{
    $boundary = 'totw_' . bin2hex(random_bytes(8));
    $headers = [
        'From: ' . sanitize_header($message['from']),
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    ];
    $body = mime_body($message['text'], $message['html'], $boundary);
    $ok = mail(
        extract_email_address($message['to']),
        encode_header($message['subject']),
        $body,
        implode("\r\n", $headers)
    );
    if (!$ok) {
        throw new RuntimeException('PHP mail() failed.');
    }
}

function smtp_send(array $config, array $message): void
{
    $host = $config['smtpHost'];
    $port = $config['smtpPort'] ?: 587;
    $remote = $config['smtpSecure'] ? 'ssl://' . $host : $host;
    $socket = fsockopen($remote, $port, $errno, $errstr, 20);
    if (!$socket) {
        throw new RuntimeException('Unable to connect to SMTP server: ' . $errno);
    }

    stream_set_timeout($socket, 20);

    try {
        smtp_expect($socket, 220);
        smtp_command($socket, 'EHLO toolsonthewheels.com', 250);

        if (!$config['smtpSecure'] && $port !== 25) {
            smtp_command($socket, 'STARTTLS', 220);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('Unable to start SMTP TLS.');
            }
            smtp_command($socket, 'EHLO toolsonthewheels.com', 250);
        }

        smtp_command($socket, 'AUTH LOGIN', 334);
        smtp_command($socket, base64_encode($config['smtpUser']), 334);
        smtp_command($socket, base64_encode($config['smtpPass']), 235);

        $fromAddress = extract_email_address($message['from']);
        $toAddress = extract_email_address($message['to']);
        smtp_command($socket, 'MAIL FROM:<' . $fromAddress . '>', 250);
        smtp_command($socket, 'RCPT TO:<' . $toAddress . '>', [250, 251]);
        smtp_command($socket, 'DATA', 354);

        $boundary = 'totw_' . bin2hex(random_bytes(8));
        $headers = [
            'Date: ' . date(DATE_RFC2822),
            'From: ' . sanitize_header($message['from']),
            'To: ' . sanitize_header($message['to']),
            'Subject: ' . encode_header($message['subject']),
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];
        $data = implode("\r\n", $headers) . "\r\n\r\n" . mime_body($message['text'], $message['html'], $boundary);
        fwrite($socket, dot_stuff($data) . "\r\n.\r\n");
        smtp_expect($socket, 250);
        smtp_command($socket, 'QUIT', 221);
    } finally {
        if (is_resource($socket)) {
            fclose($socket);
        }
    }
}

function smtp_command($socket, string $command, $expected): string
{
    fwrite($socket, $command . "\r\n");
    return smtp_expect($socket, $expected);
}

function smtp_expect($socket, $expected): string
{
    $expectedCodes = is_array($expected) ? $expected : [$expected];
    $response = '';
    $code = 0;

    do {
        $line = fgets($socket, 512);
        if ($line === false) {
            throw new RuntimeException('No response from SMTP server.');
        }
        $response .= $line;
        $code = (int) substr($line, 0, 3);
        $more = isset($line[3]) && $line[3] === '-';
    } while ($more);

    if (!in_array($code, $expectedCodes, true)) {
        throw new RuntimeException('Unexpected SMTP response code: ' . $code);
    }

    return $response;
}

function mime_body(string $text, string $html, string $boundary): string
{
    return '--' . $boundary . "\r\n" .
        "Content-Type: text/plain; charset=UTF-8\r\n" .
        "Content-Transfer-Encoding: 8bit\r\n\r\n" .
        normalize_mail_body($text) . "\r\n\r\n" .
        '--' . $boundary . "\r\n" .
        "Content-Type: text/html; charset=UTF-8\r\n" .
        "Content-Transfer-Encoding: 8bit\r\n\r\n" .
        normalize_mail_body($html) . "\r\n\r\n" .
        '--' . $boundary . '--';
}

function normalize_mail_body(string $body): string
{
    return preg_replace("/(?<!\r)\n/", "\r\n", str_replace("\r", '', $body));
}

function dot_stuff(string $data): string
{
    return preg_replace('/^\./m', '..', $data);
}

function sanitize_header(string $value): string
{
    return trim(preg_replace('/[\r\n]+/', ' ', $value));
}

function encode_header(string $value): string
{
    $value = sanitize_header($value);
    if (function_exists('mb_encode_mimeheader')) {
        return mb_encode_mimeheader($value, 'UTF-8', 'B', "\r\n");
    }
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function extract_email_address(string $value): string
{
    if (preg_match('/<([^>]+)>/', $value, $matches)) {
        return sanitize_single_line($matches[1]);
    }
    return sanitize_single_line($value);
}

function escape_html($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function safe_error(Throwable $err): string
{
    return $err->getMessage() . ' [' . get_class($err) . ']';
}
