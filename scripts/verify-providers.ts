#!/usr/bin/env bun
/**
 * Provider 批量验证脚本
 *
 * 用法:
 *   1. 复制 .env.verify.example 为 .env.verify 并填入 API Key
 *   2. bun run scripts/verify-providers.ts
 *   3. 可选参数:
 *      --only deepseek,moonshot    只验证指定 provider
 *      --skip anthropic-api        跳过指定 provider
 *      --timeout 15000             自定义超时(ms)，默认 20000
 *      --verbose                   打印完整响应体
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ─── 颜色输出 ───────────────────────────────────────────────

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

// ─── Provider 定义 ──────────────────────────────────────────

interface ProviderDef {
  id: string;
  name: string;
  baseUrl: string;
  envKey: string;          // .env.verify 中的环境变量名
  model: string;           // 测试用的模型 ID
  authHeader: 'x-api-key' | 'authorization-bearer';
  notes?: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'anthropic-api',
    name: 'Anthropic (API)',
    baseUrl: 'https://api.anthropic.com',
    envKey: 'ANTHROPIC_API_KEY',
    model: 'claude-haiku-4-5',
    authHeader: 'x-api-key',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/anthropic',
    envKey: 'DEEPSEEK_API_KEY',
    model: 'deepseek-chat',
    authHeader: 'x-api-key',
    notes: '未知模型名会自动映射到 deepseek-chat',
  },
  {
    id: 'moonshot',
    name: 'Moonshot AI (Kimi)',
    baseUrl: 'https://api.moonshot.ai/anthropic',
    envKey: 'MOONSHOT_API_KEY',
    model: 'kimi-k2.5',
    authHeader: 'x-api-key',
  },
  {
    id: 'zhipu',
    name: '智谱 AI (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/anthropic',
    envKey: 'ZHIPU_API_KEY',
    model: 'glm-4.7',
    authHeader: 'x-api-key',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    envKey: 'MINIMAX_API_KEY',
    model: 'MiniMax-M2.5',
    authHeader: 'x-api-key',
  },
  {
    id: 'qwen',
    name: '阿里云百炼 (Qwen)',
    baseUrl: 'https://dashscope.aliyuncs.com/apps/anthropic',
    envKey: 'QWEN_API_KEY',
    model: 'qwen-plus',
    authHeader: 'x-api-key',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api',
    envKey: 'OPENROUTER_API_KEY',
    model: 'anthropic/claude-haiku-4-5',
    authHeader: 'x-api-key',
    notes: 'Anthropic Skin 模式，需清空 ANTHROPIC_API_KEY',
  },
];

// ─── .env 文件加载 ───────────────────────────────────────────

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const content = readFileSync(path, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // 去引号
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

// ─── 检测项 ─────────────────────────────────────────────────

interface CheckResult {
  check: string;
  pass: boolean;
  detail: string;
  duration?: number;
}

interface ProviderReport {
  provider: ProviderDef;
  hasKey: boolean;
  checks: CheckResult[];
  overall: 'pass' | 'fail' | 'skip';
}

// Check 1: DNS 解析
async function checkDns(provider: ProviderDef): Promise<CheckResult> {
  const check = 'DNS 解析';
  try {
    const url = new URL(provider.baseUrl);
    const start = Date.now();
    // 用 fetch HEAD 测试连通性
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      await fetch(`${url.origin}`, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'manual',
      });
    } catch (e: unknown) {
      const err = e as Record<string, unknown>;
      // 即使返回错误也说明 DNS 通了（如 403/404）
      if (err?.name === 'AbortError') {
        return { check, pass: false, detail: '连接超时 (5s)', duration: Date.now() - start };
      }
      // fetch 可能因为非 HTTP 错误（如 ENOTFOUND）失败
      if ((err?.cause as Record<string, unknown>)?.code === 'ENOTFOUND') {
        return { check, pass: false, detail: `域名无法解析: ${url.hostname}`, duration: Date.now() - start };
      }
    } finally {
      clearTimeout(timer);
    }
    return { check, pass: true, detail: `${url.hostname} 可达`, duration: Date.now() - start };
  } catch (e: unknown) {
    return { check, pass: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

// Check 2: 端点路径验证（不带认证发请求看返回码）
async function checkEndpoint(provider: ProviderDef, timeoutMs: number): Promise<CheckResult> {
  const check = '端点路径';
  const url = `${provider.baseUrl}/v1/messages`;
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    const duration = Date.now() - start;
    const status = resp.status;

    // 401/403 说明端点存在，只是缺认证
    if (status === 401 || status === 403) {
      return { check, pass: true, detail: `${url} → ${status} (端点存在，需认证)`, duration };
    }
    // 404 说明路径不对
    if (status === 404) {
      return { check, pass: false, detail: `${url} → 404 (路径不存在)`, duration };
    }
    // 400 也可能是端点存在但请求体格式不对
    if (status === 400) {
      return { check, pass: true, detail: `${url} → 400 (端点存在，请求体无效)`, duration };
    }
    // 其他
    return { check, pass: true, detail: `${url} → ${status}`, duration };
  } catch (e: unknown) {
    const err = e as Record<string, unknown>;
    if (err?.name === 'AbortError') {
      return { check, pass: false, detail: `请求超时 (${timeoutMs}ms)` };
    }
    return { check, pass: false, detail: String(err?.message ?? '').slice(0, 100) };
  }
}

// Check 3: 认证 + 模型验证（带 key 发真实请求）
async function checkAuth(
  provider: ProviderDef,
  apiKey: string,
  timeoutMs: number,
  verbose: boolean,
): Promise<CheckResult> {
  const check = '认证 + 模型';
  const url = `${provider.baseUrl}/v1/messages`;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (provider.authHeader === 'x-api-key') {
    headers['x-api-key'] = apiKey;
  } else {
    headers['authorization'] = `Bearer ${apiKey}`;
  }

  const body = JSON.stringify({
    model: provider.model,
    max_tokens: 32,
    messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
  });

  try {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    const duration = Date.now() - start;
    const status = resp.status;
    const respBody = await resp.text();

    if (verbose) {
      console.log(c.dim(`    响应体: ${respBody.slice(0, 500)}`));
    }

    if (status === 200) {
      // 检查返回格式是否为 Anthropic Messages 格式
      try {
        const json = JSON.parse(respBody);
        const hasContent = json.content && Array.isArray(json.content);
        const hasRole = json.role === 'assistant';
        const formatOk = hasContent && hasRole;

        if (formatOk) {
          const text = json.content.map((b: Record<string, unknown>) => (b.text as string) ?? '').join('');
          return {
            check,
            pass: true,
            detail: `模型 ${json.model} 响应正常，回复: "${text.slice(0, 50)}"`,
            duration,
          };
        }
        return {
          check,
          pass: false,
          detail: `200 但响应格式不是 Anthropic Messages (缺少 content/role 字段)`,
          duration,
        };
      } catch {
        return { check, pass: false, detail: `200 但响应不是有效 JSON`, duration };
      }
    }

    if (status === 401) return { check, pass: false, detail: `API Key 无效 (401)`, duration };
    if (status === 403) return { check, pass: false, detail: `访问被拒绝 (403)`, duration };
    if (status === 404) return { check, pass: false, detail: `模型 ${provider.model} 不存在 (404)`, duration };
    if (status === 429) return { check, pass: false, detail: `触发速率限制 (429)，但认证有效`, duration };

    // 解析错误信息
    let errorMsg = `HTTP ${status}`;
    try {
      const json = JSON.parse(respBody);
      errorMsg += `: ${json.error?.message ?? json.message ?? respBody.slice(0, 100)}`;
    } catch {
      errorMsg += `: ${respBody.slice(0, 100)}`;
    }
    return { check, pass: false, detail: errorMsg, duration };
  } catch (e: unknown) {
    const err = e as Record<string, unknown>;
    if (err?.name === 'AbortError') {
      return { check, pass: false, detail: `请求超时 (${timeoutMs}ms)` };
    }
    return { check, pass: false, detail: String(err?.message ?? '').slice(0, 100) };
  }
}

// Check 4: Tool Calling 能力
async function checkToolCall(
  provider: ProviderDef,
  apiKey: string,
  timeoutMs: number,
  verbose: boolean,
): Promise<CheckResult> {
  const check = 'Tool Calling';
  const url = `${provider.baseUrl}/v1/messages`;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (provider.authHeader === 'x-api-key') {
    headers['x-api-key'] = apiKey;
  } else {
    headers['authorization'] = `Bearer ${apiKey}`;
  }

  const body = JSON.stringify({
    model: provider.model,
    max_tokens: 256,
    messages: [{ role: 'user', content: 'What is the weather in Beijing? Use the get_weather tool.' }],
    tools: [
      {
        name: 'get_weather',
        description: 'Get the weather for a given location',
        input_schema: {
          type: 'object',
          properties: { location: { type: 'string', description: 'City name' } },
          required: ['location'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'get_weather' },
  });

  try {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    const duration = Date.now() - start;
    const status = resp.status;
    const respBody = await resp.text();

    if (verbose) {
      console.log(c.dim(`    响应体: ${respBody.slice(0, 500)}`));
    }

    if (status !== 200) {
      if (status === 400) {
        return { check, pass: false, detail: `不支持 tool calling (400)`, duration };
      }
      return { check, pass: false, detail: `HTTP ${status}`, duration };
    }

    try {
      const json = JSON.parse(respBody);
      const toolUse = json.content?.find((b: Record<string, unknown>) => b.type === 'tool_use');
      if (toolUse) {
        const args = typeof toolUse.input === 'string' ? toolUse.input : JSON.stringify(toolUse.input);
        return {
          check,
          pass: true,
          detail: `tool_use 正常, name=${toolUse.name}, args=${args.slice(0, 80)}`,
          duration,
        };
      }
      // 有些模型可能返回文本而非 tool_use
      return {
        check,
        pass: false,
        detail: `模型未返回 tool_use block (stop_reason=${json.stop_reason})`,
        duration,
      };
    } catch {
      return { check, pass: false, detail: `响应不是有效 JSON`, duration };
    }
  } catch (e: unknown) {
    const err = e as Record<string, unknown>;
    if (err?.name === 'AbortError') {
      return { check, pass: false, detail: `请求超时 (${timeoutMs}ms)` };
    }
    return { check, pass: false, detail: String(err?.message ?? '').slice(0, 100) };
  }
}

// Check 5: SSE 流式响应
async function checkStreaming(
  provider: ProviderDef,
  apiKey: string,
  timeoutMs: number,
  verbose: boolean,
): Promise<CheckResult> {
  const check = 'SSE 流式';
  const url = `${provider.baseUrl}/v1/messages`;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (provider.authHeader === 'x-api-key') {
    headers['x-api-key'] = apiKey;
  } else {
    headers['authorization'] = `Bearer ${apiKey}`;
  }

  const body = JSON.stringify({
    model: provider.model,
    max_tokens: 32,
    stream: true,
    messages: [{ role: 'user', content: 'Reply with: ok' }],
  });

  try {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    const duration = Date.now() - start;
    const status = resp.status;

    if (status !== 200) {
      return { check, pass: false, detail: `HTTP ${status}`, duration };
    }

    const contentType = resp.headers.get('content-type') ?? '';
    const isSSE = contentType.includes('text/event-stream');

    if (!isSSE) {
      return { check, pass: false, detail: `Content-Type 不是 text/event-stream: ${contentType}`, duration };
    }

    // 读前几个 event 确认格式
    const reader = resp.body?.getReader();
    if (!reader) {
      return { check, pass: false, detail: `无响应体`, duration };
    }

    const decoder = new TextDecoder();
    let collected = '';
    let eventCount = 0;
    const readStart = Date.now();

    while (Date.now() - readStart < 10000) {
      const { value, done } = await reader.read();
      if (done) break;
      collected += decoder.decode(value, { stream: true });

      // 计算事件数
      const events = collected.split('\n\n').filter((e) => e.startsWith('event:'));
      eventCount = events.length;

      // 收到 message_start 和至少一个 content_block_delta 就够了
      if (collected.includes('message_start') && collected.includes('content_block_delta')) {
        reader.cancel().catch(() => {});
        break;
      }
    }

    if (verbose) {
      console.log(c.dim(`    SSE 前 500 字符: ${collected.slice(0, 500)}`));
    }

    const hasMessageStart = collected.includes('message_start');
    const hasDelta = collected.includes('content_block_delta');
    const hasStop = collected.includes('message_stop');

    if (hasMessageStart && hasDelta) {
      return {
        check,
        pass: true,
        detail: `SSE 格式正常 (${eventCount} events, message_start✓ delta✓${hasStop ? ' stop✓' : ''})`,
        duration: Date.now() - start,
      };
    }

    return {
      check,
      pass: false,
      detail: `SSE 事件不完整 (message_start=${hasMessageStart}, delta=${hasDelta})`,
      duration: Date.now() - start,
    };
  } catch (e: unknown) {
    const err = e as Record<string, unknown>;
    if (err?.name === 'AbortError') {
      return { check, pass: false, detail: `请求超时 (${timeoutMs}ms)` };
    }
    return { check, pass: false, detail: String(err?.message ?? '').slice(0, 100) };
  }
}

// ─── 主流程 ─────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    only: null as string[] | null,
    skip: null as string[] | null,
    timeout: 20000,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--only' && args[i + 1]) {
      opts.only = args[++i].split(',').map((s) => s.trim());
    } else if (args[i] === '--skip' && args[i + 1]) {
      opts.skip = args[++i].split(',').map((s) => s.trim());
    } else if (args[i] === '--timeout' && args[i + 1]) {
      opts.timeout = parseInt(args[++i], 10);
    } else if (args[i] === '--verbose') {
      opts.verbose = true;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();

  // 加载 .env.verify
  const envPath = join(import.meta.dir, '..', '.env.verify');
  const envVars = loadEnvFile(envPath);

  if (Object.keys(envVars).length === 0) {
    console.log(c.yellow('⚠ 未找到 .env.verify 文件或文件为空'));
    console.log(`  请复制 .env.verify.example 并填入 API Key:`);
    console.log(c.dim(`  cp scripts/.env.verify.example .env.verify`));
    console.log();
  }

  // 过滤 provider
  let providers = PROVIDERS;
  if (opts.only) {
    providers = providers.filter((p) => opts.only!.includes(p.id));
  }
  if (opts.skip) {
    providers = providers.filter((p) => !opts.skip!.includes(p.id));
  }

  console.log(c.bold('\n🔍 SoAgents Provider 批量验证\n'));
  console.log(`  超时: ${opts.timeout}ms | Verbose: ${opts.verbose}`);
  console.log(`  Provider 数量: ${providers.length}`);
  console.log();

  const reports: ProviderReport[] = [];

  for (const provider of providers) {
    const apiKey = envVars[provider.envKey] ?? '';
    const hasKey = apiKey.length > 0;

    console.log(c.bold(`━━━ ${provider.name} (${provider.id}) ━━━`));
    if (provider.notes) console.log(c.dim(`  📝 ${provider.notes}`));
    console.log(`  Base URL: ${provider.baseUrl}`);
    console.log(`  Model:    ${provider.model}`);
    console.log(`  API Key:  ${hasKey ? c.green(`${provider.envKey} = ***${apiKey.slice(-4)}`) : c.yellow(`${provider.envKey} 未配置`)}`);

    if (!hasKey) {
      console.log(c.yellow(`  ⏭ 跳过（无 API Key）\n`));
      reports.push({ provider, hasKey: false, checks: [], overall: 'skip' });
      continue;
    }

    const checks: CheckResult[] = [];

    // Check 1: DNS
    process.stdout.write(`  [1/5] DNS 解析...`);
    const dns = await checkDns(provider);
    checks.push(dns);
    console.log(dns.pass ? c.green(` ✓ ${dns.detail}`) : c.red(` ✗ ${dns.detail}`));
    if (dns.duration) process.stdout.write('');

    if (!dns.pass) {
      console.log(c.red(`  ⛔ DNS 不通，跳过后续检查\n`));
      reports.push({ provider, hasKey: true, checks, overall: 'fail' });
      continue;
    }

    // Check 2: 端点路径
    process.stdout.write(`  [2/5] 端点路径...`);
    const endpoint = await checkEndpoint(provider, opts.timeout);
    checks.push(endpoint);
    console.log(endpoint.pass ? c.green(` ✓ ${endpoint.detail}`) : c.red(` ✗ ${endpoint.detail}`));

    // Check 3: 认证 + 模型
    process.stdout.write(`  [3/5] 认证+模型...`);
    const auth = await checkAuth(provider, apiKey, opts.timeout, opts.verbose);
    checks.push(auth);
    console.log(auth.pass ? c.green(` ✓ ${auth.detail}`) : c.red(` ✗ ${auth.detail}`));

    if (!auth.pass) {
      console.log(c.yellow(`  ⚠ 认证失败，跳过 Tool Calling 和 SSE 检查\n`));
      reports.push({ provider, hasKey: true, checks, overall: 'fail' });
      continue;
    }

    // Check 4: Tool Calling
    process.stdout.write(`  [4/5] Tool Calling...`);
    const tool = await checkToolCall(provider, apiKey, opts.timeout, opts.verbose);
    checks.push(tool);
    console.log(tool.pass ? c.green(` ✓ ${tool.detail}`) : c.yellow(` ⚠ ${tool.detail}`));

    // Check 5: SSE 流式
    process.stdout.write(`  [5/5] SSE 流式...`);
    const sse = await checkStreaming(provider, apiKey, opts.timeout, opts.verbose);
    checks.push(sse);
    console.log(sse.pass ? c.green(` ✓ ${sse.detail}`) : c.red(` ✗ ${sse.detail}`));

    const overall = checks.every((c) => c.pass) ? 'pass' : 'fail';
    reports.push({ provider, hasKey: true, checks, overall });
    console.log();
  }

  // ─── 汇总报告 ────────────────────────────────────────────

  console.log(c.bold('\n════════════════════════════════════════'));
  console.log(c.bold('  汇总报告'));
  console.log(c.bold('════════════════════════════════════════\n'));

  // 表格头
  const col = (s: string, w: number) => s.padEnd(w);
  console.log(
    `  ${col('Provider', 24)} ${col('DNS', 6)} ${col('端点', 6)} ${col('认证', 6)} ${col('Tool', 6)} ${col('SSE', 6)} ${col('结果', 8)}`
  );
  console.log(`  ${'─'.repeat(62)}`);

  for (const r of reports) {
    if (r.overall === 'skip') {
      console.log(`  ${col(r.provider.name, 24)} ${c.dim('—     —     —     —     —     跳过')}`);
      continue;
    }

    const cells = ['DNS 解析', '端点路径', '认证 + 模型', 'Tool Calling', 'SSE 流式'].map((name) => {
      const ck = r.checks.find((c) => c.check === name);
      if (!ck) return c.dim('—   ');
      return ck.pass ? c.green(' ✓  ') : c.red(' ✗  ');
    });

    const overall = r.overall === 'pass' ? c.green('全部通过') : c.red('有失败');
    console.log(`  ${col(r.provider.name, 24)} ${cells.join('  ')}  ${overall}`);
  }

  // 统计
  const passed = reports.filter((r) => r.overall === 'pass').length;
  const failed = reports.filter((r) => r.overall === 'fail').length;
  const skipped = reports.filter((r) => r.overall === 'skip').length;

  console.log();
  console.log(`  ${c.green(`✓ ${passed} 通过`)}  ${c.red(`✗ ${failed} 失败`)}  ${c.dim(`⏭ ${skipped} 跳过`)}`);

  // 详细失败项
  const failedReports = reports.filter((r) => r.overall === 'fail');
  if (failedReports.length > 0) {
    console.log(c.bold('\n  失败详情:'));
    for (const r of failedReports) {
      const failedChecks = r.checks.filter((c) => !c.pass);
      for (const fc of failedChecks) {
        console.log(c.red(`  • ${r.provider.name} → ${fc.check}: ${fc.detail}`));
      }
    }
  }

  console.log();

  // 退出码
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(c.red(`\n脚本异常: ${e.message}`));
  process.exit(2);
});
