<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

echo json_encode(['success' => true, 'status' => 'ok', 'runtime' => 'php'], JSON_UNESCAPED_SLASHES);
