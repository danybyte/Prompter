export function repairJson(jsonStr: string): string {
  let str = jsonStr.trim();
  if (!str) return '{}';

  try {
    JSON.parse(str);
    return str;
  } catch (_) {}

  let cleaned = '';
  let inString = false;
  let escape = false;
  const bracketsStack: string[] = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escape) { cleaned += char; escape = false; continue; }
    if (char === '\\') { cleaned += char; escape = true; continue; }
    if (char === '\"') { inString = !inString; cleaned += char; continue; }
    cleaned += char;
    if (!inString) {
      if (char === '{' || char === '[') bracketsStack.push(char);
      else if (char === '}' && bracketsStack[bracketsStack.length - 1] === '{') bracketsStack.pop();
      else if (char === ']' && bracketsStack[bracketsStack.length - 1] === '[') bracketsStack.pop();
    }
  }

  if (inString) {
    if (cleaned.endsWith('\\')) cleaned = cleaned.slice(0, -1);
    cleaned += '\"';
  }

  let tempCleaned = cleaned;
  const tempStack = [...bracketsStack];
  while (tempStack.length > 0) {
    const last = tempStack.pop();
    if (last === '{') tempCleaned += '}';
    if (last === '[') tempCleaned += ']';
  }
  try { JSON.parse(tempCleaned); return tempCleaned; } catch (_) {}

  let lastValidCut = -1;
  inString = false; escape = false;
  const currentBrackets: string[] = [];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    if (char === '\"') { inString = !inString; continue; }
    if (!inString) {
      if (char === '{' || char === '[') { currentBrackets.push(char); lastValidCut = i; }
      else if (char === '}') { currentBrackets.pop(); lastValidCut = i; }
      else if (char === ']') { currentBrackets.pop(); lastValidCut = i; }
      else if (char === ',') lastValidCut = i;
    }
  }

  if (lastValidCut !== -1) {
    let sliced = str.substring(0, lastValidCut).trim();
    if (sliced.endsWith(',')) sliced = sliced.substring(0, sliced.length - 1);
    const finalStack: string[] = [];
    inString = false; escape = false;
    for (let i = 0; i < sliced.length; i++) {
      const char = sliced[i];
      if (escape) { escape = false; continue; }
      if (char === '\\') { escape = true; continue; }
      if (char === '\"') { inString = !inString; continue; }
      if (!inString) {
        if (char === '{' || char === '[') finalStack.push(char);
        else if (char === '}' && finalStack[finalStack.length - 1] === '{') finalStack.pop();
        else if (char === ']' && finalStack[finalStack.length - 1] === '[') finalStack.pop();
      }
    }
    if (inString) { if (sliced.endsWith('\\')) sliced = sliced.slice(0, -1); sliced += '\"'; }
    while (finalStack.length > 0) {
      const last = finalStack.pop();
      if (last === '{') sliced += '}';
      if (last === '[') sliced += ']';
    }
    try { JSON.parse(sliced); return sliced; } catch (_) {}
  }
  return jsonStr;
}
