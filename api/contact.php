<?php
/**
 * Public enquiry endpoint. Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from /.env.
 * POST JSON: { name, email, phone, company, message, source }
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(array('ok' => false, 'error' => 'method'));
  exit;
}

function tcv_load_env($path) {
  if (!is_readable($path)) {
    return;
  }
  $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
  if (!$lines) {
    return;
  }
  foreach ($lines as $line) {
    $line = trim($line);
    if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
      continue;
    }
    list($key, $value) = explode('=', $line, 2);
    $key = trim($key);
    $value = trim($value);
    $value = trim($value, "\"'");
    if ($key !== '' && getenv($key) === false) {
      putenv($key . '=' . $value);
    }
  }
}

tcv_load_env(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');

$token = getenv('TELEGRAM_BOT_TOKEN');
$chatId = getenv('TELEGRAM_CHAT_ID');
if (!$token || !$chatId) {
  http_response_code(503);
  echo json_encode(array('ok' => false, 'error' => 'not_configured'));
  exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
  http_response_code(400);
  echo json_encode(array('ok' => false, 'error' => 'json'));
  exit;
}

function tcv_field($data, $key, $max) {
  $value = isset($data[$key]) ? trim((string) $data[$key]) : '';
  if (strlen($value) > $max) {
    $value = substr($value, 0, $max);
  }
  return $value;
}

$name = tcv_field($data, 'name', 120);
$email = tcv_field($data, 'email', 180);
$phone = tcv_field($data, 'phone', 60);
$company = tcv_field($data, 'company', 160);
$message = tcv_field($data, 'message', 4000);
$source = tcv_field($data, 'source', 300);

if ($name === '' || $email === '' || $phone === '' || $message === '') {
  http_response_code(422);
  echo json_encode(array('ok' => false, 'error' => 'fields'));
  exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(422);
  echo json_encode(array('ok' => false, 'error' => 'email'));
  exit;
}

$text = "New enquiry — TEAM CHENDAWAN VENTURES\n"
  . "Name: {$name}\n"
  . "Email: {$email}\n"
  . "Phone: {$phone}\n"
  . "Company: " . ($company !== '' ? $company : '—') . "\n"
  . "Source: " . ($source !== '' ? $source : '—') . "\n\n"
  . $message;

$payload = json_encode(array(
  'chat_id' => $chatId,
  'text' => $text,
));

$url = 'https://api.telegram.org/bot' . $token . '/sendMessage';
$ctx = stream_context_create(array(
  'http' => array(
    'method' => 'POST',
    'header' => "Content-Type: application/json\r\n",
    'content' => $payload,
    'timeout' => 12,
    'ignore_errors' => true,
  ),
));

$resp = @file_get_contents($url, false, $ctx);
$ok = false;
if ($resp) {
  $decoded = json_decode($resp, true);
  $ok = is_array($decoded) && !empty($decoded['ok']);
}

if (!$ok) {
  http_response_code(502);
  echo json_encode(array('ok' => false, 'error' => 'telegram'));
  exit;
}

echo json_encode(array('ok' => true));
