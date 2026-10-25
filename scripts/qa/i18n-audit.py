#!/usr/bin/env python3
"""i18n 全量审计：三类问题清单（中英全覆盖改造依据）
A) 未包 t()/tpl() 的中文 UI 字面量 → EN 模式显示中文
B) t()/tpl() 的 key 在 EN 字典缺失 → EN 模式回退中文
C) t()/tpl() 的 key 不含中文（纯英文 key）→ ZH 模式显示英文
用法：python3 scripts/qa/i18n-audit.py（仓库根运行）
"""
import re, os, glob, subprocess

ROOT = "/Users/chenlt/Documents/Work/xujianshiguang"
WEB = os.path.join(ROOT, "apps/web/src")
CJK = re.compile(r"[\u4e00-\u9fff]")

# ---- 1) 正则解析 EN 字典全部 key ----
DICT = set()
KEY_RE = re.compile(r'''^\s*(?:"((?:[^"\\]|\\.)+)"|'([^']+)'|([^:\n"']+?)):\s*"''')
for df in glob.glob(os.path.join(WEB, "i18n/en/*.ts")):
    for line in open(df, encoding="utf-8"):
        m = KEY_RE.match(line.rstrip())
        if m:
            k = m.group(1) or m.group(2) or m.group(3)
            DICT.add(k.replace('\\"', '"'))

# ---- 2) 扫源码 ----
def strip_comments(src):
    out = []; i = 0; n = len(src); mode = None
    while i < n:
        c = src[i]; nxt = src[i + 1] if i + 1 < n else ""
        if mode is None:
            if c in ('"', "'", "`"):
                mode = c; out.append(c); i += 1; continue
            if c == "/" and nxt == "/":
                mode = "line"; i += 2; continue
            if c == "/" and nxt == "*":
                mode = "block"; i += 2; continue
            out.append(c); i += 1
        elif mode in ('"', "'", "`"):
            if c == "\\":
                out.append("  "); i += 2; continue
            if c == mode or (mode != "`" and c == "\n"):
                mode = None
            out.append(c if c != "\n" else "\n"); i += 1
        elif mode == "line":
            if c == "\n":
                mode = None; out.append("\n")
            i += 1
        else:
            if c == "*" and nxt == "/":
                mode = None; i += 2; continue
            i += 1
    return "".join(out)

files = subprocess.run(
    ["bash", "-c", 'find "%s" -name "*.tsx" -o -name "*.ts" | grep -v "src/i18n/"' % WEB],
    capture_output=True, text=True).stdout.split()

STR_RE = re.compile(r'"([^"\\]*(?:\\.[^"\\]*)*)"|\'([^\'\\]*(?:\\.[^\'\\]*)*)\'')
ASCII_KEY = re.compile(r'[A-Za-z0-9 _\-\'\.,/()&%+#!?\[\]]+')

report = {"A_unwrapped": {}, "B_missing_dict": {}, "C_ascii_key": {}}
for f in sorted(files):
    src = open(f, encoding="utf-8").read()
    clean = strip_comments(src)
    a_items = []; b_items = []; c_items = []
    for ln_no, line in enumerate(clean.splitlines(), 1):
        for m in re.finditer(r'\b(?:t|tpl|tr)\(\s*([\'"])([A-Za-z0-9 _\-\'\.,/()&%+#!?\[\]]+)\1', line):
            c_items.append(m.group(2))
        if not CJK.search(line):
            continue
        for m in re.finditer(r'\b(?:t|tpl|tr)\(\s*([\'"])(.+?)\1', line):
            key = m.group(2).replace('\\"', '"')
            if CJK.search(key):
                if key not in DICT:
                    b_items.append(key)
            else:
                c_items.append(key)
        for m in STR_RE.finditer(line):
            lit = m.group(1) if m.group(1) is not None else m.group(2)
            if not CJK.search(lit):
                continue
            before = line[:m.start()].rstrip()
            if re.search(r'\b(?:t|tpl|tr)\($', before):
                continue
            if re.match(r'^(import|export)\b', line.strip()):
                continue
            if re.search(r'\bconsole\.\w+', before):
                continue
            after = line[m.end():].lstrip()
            a_items.append((lit[:44], "enum-key" if after.startswith(":") else "text", ln_no))
        for m in re.finditer(r'>\s*([^<>{}]*[\u4e00-\u9fff][^<>{}]*)', line):
            frag = m.group(1).strip()
            pre = line[:m.start()].rstrip()
            if frag and not re.search(r'\b(?:t|tpl|tr)\(\s*$', pre) and not re.match(r'^(?:t|tr|tpl)\(', frag):
                a_items.append((frag[:44], "jsx", ln_no))
    if a_items:
        report["A_unwrapped"][os.path.relpath(f, ROOT)] = a_items
    if b_items:
        report["B_missing_dict"][os.path.relpath(f, ROOT)] = sorted(set(b_items))
    if c_items:
        report["C_ascii_key"][os.path.relpath(f, ROOT)] = sorted(set(c_items))

tot_a = sum(len(v) for v in report["A_unwrapped"].values())
tot_b = sum(len(v) for v in report["B_missing_dict"].values())
tot_c = sum(len(v) for v in report["C_ascii_key"].values())
print("DICT keys: %d" % len(DICT))
print("A) unwrapped CJK strings: %d 条 / %d 个文件" % (tot_a, len(report["A_unwrapped"])))
print("B) t() keys missing from EN dict: %d" % tot_b)
print("C) t() ascii keys (break ZH): %d" % tot_c)
print()
for f, items in sorted(report["A_unwrapped"].items(), key=lambda kv: -len(kv[1])):
    enums = sum(1 for i in items if i[1] == "enum-key")
    print("## %s  (%d 条, %d enum)" % (f, len(items), enums))
    for i in items[:5]:
        print("   - [%s L%d] %s" % (i[1], i[2], i[0]))
    if len(items) > 5:
        print("   ... 共 %d 条" % len(items))
print("\n===== B missing =====")
for f, items in report["B_missing_dict"].items():
    print("## %s: %s%s" % (f, items[:10], " ..." if len(items) > 10 else ""))
print("\n===== C ascii keys =====")
for f, items in report["C_ascii_key"].items():
    print("## %s: %s%s" % (f, items[:10], " ..." if len(items) > 10 else ""))
