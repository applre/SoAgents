/**
 * 解析不完整的流式 JSON。
 * 流式传输时 tool_use 参数是逐块到达的，JSON 经常不完整。
 * 本函数尝试自动补全缺失的引号、括号，尽可能多地解析出内容。
 *
 * 策略:
 * 1. 直接 JSON.parse
 * 2. 分析结构，补全未闭合的字符串/括号
 * 3. 尝试解析最长的平衡前缀（处理尾部垃圾数据）
 * 4. 回退到最后一个逗号处截断，去掉不完整的字段
 */
export function parsePartialJson<T = unknown>(jsonString: string): T | null {
  if (!jsonString || jsonString.trim() === '') {
    return null;
  }

  // 直接尝试解析
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    // 不是合法 JSON，继续增量解析
  }

  // 分析结构，补全缺失部分
  const state = analyzePartialJson(jsonString);

  try {
    return JSON.parse(state.completed) as T;
  } catch {
    // 继续回退策略
  }

  // 尝试解析最长的平衡前缀
  const prefixEnd = state.prefixEnd;
  if (
    typeof prefixEnd === 'number' &&
    prefixEnd > 0 &&
    (!state.structuralError || state.lastTopLevelCommaIndex === -1)
  ) {
    const balancedPrefix = jsonString.slice(0, prefixEnd).trimEnd();
    if (balancedPrefix) {
      const prefixState = analyzePartialJson(balancedPrefix);
      try {
        return JSON.parse(prefixState.completed) as T;
      } catch {
        try {
          return JSON.parse(balancedPrefix) as T;
        } catch {
          // 前缀也无法解析，继续回退
        }
      }
    }
  }

  return tryParseLastCompleteField<T>(jsonString);
}

type PartialJsonState = {
  completed: string;
  prefixEnd: number | null;
  structuralError: boolean;
  lastTopLevelCommaIndex: number;
};

function analyzePartialJson(jsonString: string): PartialJsonState {
  const stack: string[] = [];
  let inString = false;
  let escapeNext = false;
  let lastBalancedIndex = -1;
  let firstGarbageIndex: number | null = null;
  let structuralError = false;
  let lastTopLevelCommaIndex = -1;

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];

    const balancedAndStarted = !inString && stack.length === 0 && lastBalancedIndex !== -1;
    if (balancedAndStarted) {
      if (isWhitespace(char)) {
        lastBalancedIndex = i + 1;
        continue;
      }
      firstGarbageIndex = i;
      break;
    }

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      if (!inString && stack.length === 0) {
        lastBalancedIndex = i + 1;
      }
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === ',' && !inString) {
      if (stack.length === 1) {
        lastTopLevelCommaIndex = i;
      }
      continue;
    }

    if (char === '{') {
      stack.push('}');
    } else if (char === '[') {
      stack.push(']');
    } else if (char === '}' || char === ']') {
      if (stack.length === 0) {
        structuralError = true;
        firstGarbageIndex = i;
        break;
      }

      const expected = stack[stack.length - 1];
      if (expected !== char) {
        structuralError = true;
        firstGarbageIndex = i;
        break;
      }

      stack.pop();

      if (stack.length === 0) {
        lastBalancedIndex = i + 1;
      }
    }
  }

  // 补全未闭合的字符串
  let completed = jsonString;
  if (inString) {
    completed += '"';
  }

  // 按栈逆序补全缺失的括号
  while (stack.length > 0) {
    const missing = stack.pop();
    if (missing) {
      completed += missing;
    }
  }

  const prefixEnd = firstGarbageIndex !== null ? firstGarbageIndex : lastBalancedIndex;

  return {
    completed,
    prefixEnd: typeof prefixEnd === 'number' ? prefixEnd : null,
    structuralError,
    lastTopLevelCommaIndex,
  };
}

/**
 * 回退策略：在最后一个逗号处截断，去掉不完整的字段
 */
function tryParseLastCompleteField<T>(jsonString: string): T | null {
  const lastCommaIndex = jsonString.lastIndexOf(',');
  if (lastCommaIndex === -1) {
    return null;
  }

  let truncated = jsonString.substring(0, lastCommaIndex);

  const stack: string[] = [];
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < truncated.length; i++) {
    const char = truncated[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      stack.push('}');
    } else if (char === '}') {
      stack.pop();
    } else if (char === '[') {
      stack.push(']');
    } else if (char === ']') {
      stack.pop();
    }
  }

  if (inString) {
    truncated += '"';
  }
  while (stack.length > 0) {
    truncated += stack.pop();
  }

  try {
    return JSON.parse(truncated) as T;
  } catch {
    return null;
  }
}

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t' || char === '\f';
}
