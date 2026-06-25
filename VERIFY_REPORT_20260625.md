# IFM Matrix 标准 Worksheet · 运行验证报告

**日期**：2026-06-25
**被测文件**：`IFMMatrix_standard_worksheet_morandi_20260625.html`
**验证工具**：Playwright（`_verify_tmp/node_modules`）+ 本地缓存 Chromium（`Google Chrome for Testing`，离线，无联网）
**脚本**：`_verify_tmp/verify_standard_worksheet.js`

## [desktop 1280×900] PASS
- 7 生理节点 (#ring .node-box)：7（expect 7）✓
- 中心 MES (.mes-core)：1（expect 1）✓
- 左 ATM 三段 (.atm-sec)：3（expect 3）✓
- 底 5 生活方式 (.ls-item)：5（expect 5）✓
- 导出按钮："📄 导出PDF"（expect "📄 导出PDF"）✓
- 禁词（打鼾/呼吸暂停/血糖调节）命中：none ✓
- 含"血糖代谢"：true ✓
- 脂质→Transport 映射（脂质运输/高脂血症）：true ✓
- 创建者署名：true ✓
- AI 设置抽屉：1 / 粘贴资料区：1（二者分离）✓
- scrollW=1280 clientW=1280 横向溢出：false ✓
- console errors：0 ✓

## [mobile 390×844] PASS
- 7 生理节点：7 ✓ ／ 中心 MES：1 ✓ ／ 左 ATM：3 ✓ ／ 底 5 生活方式：5 ✓
- 导出按钮："📄 导出PDF" ✓
- 禁词命中：none ✓ ／ 含"血糖代谢"：true ✓ ／ 脂质→Transport：true ✓ ／ 创建者署名：true ✓
- AI 设置抽屉：1 / 粘贴资料区：1（分离）✓
- scrollW=390 clientW=390 横向溢出：false ✓
- console errors：0 ✓
- 移动端堆叠：ATM 顶 → 7 节点单列 → MES 核（圆改圆角卡片）→ 5 列生活方式 → 页脚，worksheet 三区语义保持。

## OVERALL: PASS

人工核验截图：
- `IFMMatrix_standard_worksheet_morandi_desktop_20260625.png`：左 ATM｜中 3×3 环（7 节点环绕椭圆 MES 核，顶部 Physiology & Function 抬头）｜底 5 列生活方式｜创建者署名，配色为低饱和 Morandi。
- `IFMMatrix_standard_worksheet_morandi_mobile_20260625.png`：纵向堆叠、无横向溢出、Transport 脂质映射注脚可见。
