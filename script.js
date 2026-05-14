const toggleLanguageButton = document.getElementById('toggleLanguage');
const editableSelector = '[data-en]';
const saveEndpoint = 'http://127.0.0.1:5501/save-index';
let isEditMode = false;
let statusTimer = null;

function pageIsChinese() {
    return toggleLanguageButton.textContent === 'English';
}

function showEditStatus(message, isError = false) {
    let banner = document.getElementById('edit-mode-status');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'edit-mode-status';
        banner.style.position = 'fixed';
        banner.style.right = '16px';
        banner.style.bottom = '16px';
        banner.style.zIndex = '99999';
        banner.style.padding = '10px 14px';
        banner.style.borderRadius = '8px';
        banner.style.fontSize = '13px';
        banner.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        banner.style.color = '#ffffff';
        banner.style.background = 'rgba(20, 20, 20, 0.92)';
        banner.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';
        banner.style.maxWidth = '360px';
        document.body.appendChild(banner);
    }

    banner.textContent = message;
    banner.style.background = isError ? 'rgba(170, 30, 30, 0.95)' : 'rgba(20, 20, 20, 0.92)';
    banner.style.display = 'block';

    if (statusTimer) {
        clearTimeout(statusTimer);
    }
    statusTimer = setTimeout(() => {
        if (banner) {
            banner.style.display = 'none';
        }
    }, 2600);
}

function setEditMode(enabled) {
    isEditMode = enabled;
    document.body.classList.toggle('edit-mode-enabled', enabled);

    document.querySelectorAll(editableSelector).forEach((el) => {
        if (enabled) {
            el.setAttribute('contenteditable', 'true');
            el.classList.add('inline-editing');
        } else {
            el.removeAttribute('contenteditable');
            el.classList.remove('inline-editing');
        }
    });
}

function syncBilingualAttrsFromCurrentView() {
    const chineseMode = pageIsChinese();
    document.querySelectorAll(editableSelector).forEach((el) => {
        const currentText = el.textContent;
        if (chineseMode) {
            el.setAttribute('data-zh', currentText);
        } else {
            // 英文模式下同时更新 data-en 与标签正文文本
            el.setAttribute('data-en', currentText);
            el.textContent = currentText;
        }
    });
}

function buildSavableHtml() {
    syncBilingualAttrsFromCurrentView();
    const rootClone = document.documentElement.cloneNode(true);

    // 中文编辑时仅持久化 data-zh，正文仍保持英文（来自 data-en）
    if (pageIsChinese()) {
        rootClone.querySelectorAll(editableSelector).forEach((el) => {
            const englishText = el.getAttribute('data-en');
            if (englishText !== null) {
                el.textContent = englishText;
            }
        });
    }

    rootClone.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
    rootClone.querySelectorAll('.inline-editing').forEach((el) => el.classList.remove('inline-editing'));
    rootClone.classList.remove('edit-mode-enabled');

    const clonedStatus = rootClone.querySelector('#edit-mode-status');
    if (clonedStatus) {
        clonedStatus.remove();
    }

    cleanInjectedEditorArtifacts(rootClone);

    return `<!DOCTYPE html>\n${rootClone.outerHTML}\n`;
}

function cleanInjectedEditorArtifacts(rootClone) {
    rootClone.querySelectorAll('#monica-content-root, #monica-writing-entry-btn-root, .monica-widget').forEach((el) => {
        el.remove();
    });

    rootClone.querySelectorAll('style').forEach((el) => {
        const text = el.textContent || '';
        if (el.id === 'monica-reading-highlight-style' || text.includes('.imageye-selected')) {
            el.remove();
        }
    });

    rootClone.querySelectorAll('script').forEach((el) => {
        const text = el.textContent || '';
        if (text.includes('Live reload enabled.') || text.includes('Code injected by live-server')) {
            el.remove();
        }
    });

    const commentWalker = document.createTreeWalker(rootClone, NodeFilter.SHOW_COMMENT);
    const commentsToRemove = [];
    while (commentWalker.nextNode()) {
        const node = commentWalker.currentNode;
        if (node.textContent.includes('Code injected by live-server')) {
            commentsToRemove.push(node);
        }
    }
    commentsToRemove.forEach((node) => node.remove());

    rootClone.querySelectorAll('*').forEach((el) => {
        Array.from(el.attributes).forEach((attr) => {
            if (attr.name.startsWith('data-listener-added_') || attr.name.startsWith('monica-')) {
                el.removeAttribute(attr.name);
            }
        });

        if (el.getAttribute('class') === '') {
            el.removeAttribute('class');
        }
    });
}

async function saveIndexHtml() {
    const html = buildSavableHtml();
    const response = await fetch(saveEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ html })
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Save failed with status ${response.status}`);
    }
}

function exportToWord() {
    const isChinese = pageIsChinese();
    const get = (el) => {
        if (!el) return '';
        return isChinese ? (el.getAttribute('data-zh') || el.textContent) : (el.getAttribute('data-en') || el.textContent);
    };

    const headerInfo = document.querySelector('.header .info');
    const name = get(headerInfo.querySelector('h1'));
    const ps = headerInfo.querySelectorAll('p');
    const contact = get(ps[0]);
    const address = get(ps[1]);
    const interests = get(ps[2]);

    let html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<title>${name}</title>
<!--[if gte mso 9]><xml>
<w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml><![endif]-->
<style>
  @page { size: 210mm 297mm; margin: 1.27cm; mso-page-orientation: portrait; }
  @page Section1 { size: 595.3pt 841.9pt; margin: 1.27cm; mso-header-margin: 0; mso-footer-margin: 0; }
  div.Section1 { page: Section1; }
  body { font-family: Arial, sans-serif; font-size: 8pt; line-height: 1.15; color: #000; margin: 0; padding: 4pt 19pt; }
  .header-wrap { margin-bottom: 4pt; }
  h1 { font-size: 13.5pt; text-align: center; margin: 0 0 3pt 0; }
  .contact-line { text-align: center; font-size: 7.5pt; margin: 1pt 0; }
  h2 { font-size: 10pt; border-bottom: 1pt solid #000; margin: 6pt 0 3pt 0; padding-bottom: 0; }
  .entry-table { width: 100%; margin: 2pt 0 1pt 0; }
  .entry-table td { padding: 0; }
  .entry-table .title-left { text-align: left; font-size: 9pt; font-weight: bold; }
  .entry-table .title-right { text-align: right; font-size: 7.5pt; white-space: nowrap; }
  .bullet-item { margin: 0.5pt 0 0.5pt 15pt; font-size: 7.5pt; }
  .skill-item { margin: 0.5pt 0 0.5pt 7.5pt; font-size: 7.5pt; }
  .data-table { width: 100%; margin: 1pt 0; }
  .data-table td { padding: 1pt 4pt; font-size: 7.5pt; vertical-align: top; }
  .data-table td:first-child { padding-left: 7.5pt; }
  table { border: none; border-collapse: collapse; mso-border-alt: solid #ffffff 0; mso-border-insideh: none; mso-border-insidev: none; mso-padding-alt: 0; }
  table td { border: none; mso-border-alt: solid #ffffff 0; mso-border-insideh: none; mso-border-insidev: none; }
  table tr { border: none; mso-border-alt: solid #ffffff 0; }
</style>
</head>
<body>
<div class="Section1">
<div class="header-wrap">
<h1>${name}</h1>
<p class="contact-line">${contact}</p>
<p class="contact-line">${address}</p>
<p class="contact-line">${interests}</p>
</div>
`;

    const sections = document.querySelectorAll('.section[id]');
    sections.forEach((section) => {
        if (section.id === 'appendix' || section.classList.contains('print-hide')) return;

        const h2 = section.querySelector('h2');
        if (!h2) return;
        html += `<h2>${get(h2)}</h2>\n`;

        Array.from(section.children).forEach((child) => {
            if (child.tagName === 'H2' || child.classList.contains('print-hide')) return;

            if (child.classList.contains('h3container')) {
                const h3 = child.querySelector('h3');
                const p = child.querySelector('p');
                html += `<table class="entry-table" border="0" cellpadding="0" cellspacing="0"><tr><td class="title-left">${get(h3)}</td><td class="title-right">${get(p)}</td></tr></table>\n`;
            } else if (child.tagName === 'UL') {
                const itemClass = section.id === 'skills' ? 'skill-item' : 'bullet-item';
                child.querySelectorAll('li').forEach((li) => {
                    html += `<p class="${itemClass}">\u2022  ${get(li)}</p>\n`;
                });
            } else if (child.tagName === 'TABLE') {
                html += '<table class="data-table" border="0" cellpadding="0" cellspacing="0">\n';
                child.querySelectorAll('tr').forEach((tr) => {
                    html += '<tr>\n';
                    const tds = tr.querySelectorAll('td');
                    tds.forEach((td, i) => {
                        let text = '';
                        if (td.hasAttribute('data-en')) {
                            text = get(td);
                        } else {
                            td.childNodes.forEach((node) => {
                                if (node.nodeType === 3) {
                                    text += node.textContent;
                                } else if (node.hasAttribute && node.hasAttribute('data-en')) {
                                    text += get(node);
                                } else if (node.classList && node.classList.contains('bullet')) {
                                    text += '\u2022 ';
                                }
                            });
                        }
                        const align = i === tds.length - 1 ? ' style="text-align:right"' : '';
                        html += `<td${align}>${text.trim()}</td>\n`;
                    });
                    html += '</tr>\n';
                });
                html += '</table>\n';
            }
        });
    });

    html += '</div></body></html>';

    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isChinese ? '田骐嘉_简历.doc' : 'TianQijia_Resume.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

toggleLanguageButton.addEventListener('click', () => {
    const isChinese = toggleLanguageButton.textContent === '中文';
    toggleLanguageButton.textContent = isChinese ? 'English' : '中文';

    document.querySelectorAll(editableSelector).forEach((el) => {
        el.textContent = isChinese ? el.getAttribute('data-zh') : el.getAttribute('data-en');
    });
});

// 选择所有的导航链接
const navLinks = document.querySelectorAll('.nav ul li a');

// 定义每个部分的元素及其对应的导航链接
const sections = document.querySelectorAll('.section[id]');
const sectionMap = {};
sections.forEach((section) => {
    const id = section.getAttribute('id');
    sectionMap[id] = document.querySelector(`.nav ul li a[href="#${id}"]`);
});

// 监听滚动事件
window.addEventListener('scroll', () => {
    let current = '';

    sections.forEach((section) => {
        const sectionTop = section.offsetTop;
        if (window.scrollY >= sectionTop - 100) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach((link) => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

document.addEventListener('keydown', async (event) => {
    const appendix = document.getElementById('appendix');
    const activities = document.getElementById('activities');
    const nav = document.querySelector('.nav');

    const target = event.target;
    const isTypingField = Boolean(
        target &&
        (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)
    );

    if ((event.key === 'i' || event.key === 'I') && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (target && target.isContentEditable) {
            return;
        }
        event.preventDefault();
        setEditMode(!isEditMode);
        if (isEditMode) {
            showEditStatus('Edit mode ON. Press Ctrl/Cmd+S to save.');
        } else {
            showEditStatus('Edit mode OFF.');
        }
        return;
    }

    if ((event.key === 's' || event.key === 'S') && (event.ctrlKey || event.metaKey)) {
        if (!isEditMode) {
            return;
        }
        event.preventDefault();
        try {
            await saveIndexHtml();
            showEditStatus('Saved to index.html successfully.');
        } catch (error) {
            showEditStatus(`Save failed: ${error.message}`, true);
        }
        return;
    }

    if (isTypingField) {
        return;
    }

    if (event.key === 'h') {
        if (appendix) appendix.style.display = 'none';
        if (activities) activities.style.display = 'none';
        if (nav) nav.style.display = 'none';
    } else if (event.key === 'j') {
        if (appendix) appendix.style.display = 'block';
        if (activities) activities.style.display = 'block';
        if (nav) nav.style.display = 'block';
    } else if (event.key === '0') {
        document.body.classList.toggle('resume-print-mode');
    } else if (event.key === 'w' || event.key === 'W') {
        event.preventDefault();
        exportToWord();
    }
});

const exportWordButton = document.getElementById('exportWord');
if (exportWordButton) {
    exportWordButton.addEventListener('click', exportToWord);
}

document.querySelectorAll('.nav ul li a').forEach((link) => {
    link.addEventListener('click', (event) => {
        event.preventDefault(); // 阻止默认跳转行为
        const targetId = link.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        if (!targetElement) {
            return;
        }

        // 获取目标元素的顶部位置并调整
        const offsetTop = targetElement.offsetTop - 60; // 这里的 60 是你想要的偏移量，可以根据需要调整

        window.scrollTo({
            top: offsetTop,
            behavior: 'smooth' // 平滑滚动
        });

        // 移除所有按钮的激活状态
        document.querySelectorAll('.nav ul li a, .nav ul li button').forEach((btn) => {
            btn.classList.remove('active');
        });
        // 添加当前按钮的激活状态
        link.classList.add('active');
    });
});
