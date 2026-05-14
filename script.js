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
    }
});

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
