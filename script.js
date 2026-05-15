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
    rootClone.querySelectorAll('#resumeExportModal, #monica-content-root, #monica-writing-entry-btn-root, .monica-widget').forEach((el) => {
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

const exportDefaults = {
    format: 'pdf',
    lineHeight: 1.24,
    fontName: 15,
    fontContact: 8,
    fontSection: 10.5,
    fontEntry: 9.2,
    fontBody: 8.4,
    fontDate: 8
};
let resumeExportSettings = null;

function exportLabel(en, zh) {
    return pageIsChinese() ? zh : en;
}

function getLocalizedText(el) {
    if (!el) return '';
    return pageIsChinese() ? (el.getAttribute('data-zh') || el.textContent) : (el.getAttribute('data-en') || el.textContent);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getExportContentModel() {
    const sections = Array.from(document.querySelectorAll('.section[id]'))
        .filter((section) => section.id !== 'appendix')
        .map((section) => {
            const h2 = section.querySelector('h2');
            const entries = [];
            Array.from(section.children).forEach((child) => {
                if (!child.classList || !child.classList.contains('h3container')) return;
                const detail = child.nextElementSibling && child.nextElementSibling.tagName === 'UL' ? child.nextElementSibling : null;
                const title = getLocalizedText(child.querySelector('h3'));
                const date = getLocalizedText(child.querySelector('p'));
                entries.push({
                    key: `${section.id}-${entries.length}`,
                    sectionKey: section.id,
                    heading: child,
                    detail,
                    title,
                    date,
                    defaultIncluded: !child.classList.contains('print-hide') && !(detail && detail.classList.contains('print-hide'))
                });
            });

            return {
                key: section.id,
                el: section,
                title: getLocalizedText(h2),
                defaultIncluded: !section.classList.contains('print-hide'),
                entries
            };
        });

    return {
        sections,
        entries: sections.flatMap((section) => section.entries)
    };
}

function buildDefaultExportSettings() {
    const model = getExportContentModel();
    return {
        ...exportDefaults,
        sectionKeys: model.sections.filter((section) => section.defaultIncluded).map((section) => section.key),
        entryKeys: model.entries.filter((entry) => entry.defaultIncluded).map((entry) => entry.key)
    };
}

function getActiveExportSettings() {
    const defaults = buildDefaultExportSettings();
    if (!resumeExportSettings) return defaults;

    const sectionKeys = new Set(resumeExportSettings.sectionKeys || []);
    const entryKeys = new Set(resumeExportSettings.entryKeys || []);
    defaults.sectionKeys.forEach((key) => {
        if (!resumeExportSettings.sectionKeys) sectionKeys.add(key);
    });
    defaults.entryKeys.forEach((key) => {
        if (!resumeExportSettings.entryKeys) entryKeys.add(key);
    });

    return {
        ...defaults,
        ...resumeExportSettings,
        sectionKeys: Array.from(sectionKeys),
        entryKeys: Array.from(entryKeys)
    };
}

function openExportOptions() {
    if (isEditMode) {
        syncBilingualAttrsFromCurrentView();
    }

    const existing = document.getElementById('resumeExportModal');
    if (existing) existing.remove();

    const model = getExportContentModel();
    const settings = getActiveExportSettings();
    const sectionKeys = new Set(settings.sectionKeys);
    const entryKeys = new Set(settings.entryKeys);
    const labels = {
        title: exportLabel('Resume Export', '简历导出'),
        format: exportLabel('Format', '格式'),
        pdf: exportLabel('PDF (open print dialog)', 'PDF（打开打印窗口）'),
        word: exportLabel('Word document', 'Word 文档'),
        sections: exportLabel('Sections', '简历部分'),
        details: exportLabel('Detailed entries', '具体经历'),
        typography: exportLabel('Typography', '排版设置'),
        lineHeight: exportLabel('Line spacing', '行距'),
        fontName: exportLabel('Name size (pt)', '姓名字号（pt）'),
        fontContact: exportLabel('Contact size (pt)', '联系方式字号（pt）'),
        fontSection: exportLabel('Section title size (pt)', '部分标题字号（pt）'),
        fontEntry: exportLabel('Entry title size (pt)', '经历标题字号（pt）'),
        fontBody: exportLabel('Body text size (pt)', '正文字号（pt）'),
        fontDate: exportLabel('Date size (pt)', '日期字号（pt）'),
        preview: exportLabel('Preview', '预览'),
        cancel: exportLabel('Cancel', '取消'),
        reset: exportLabel('Defaults', '恢复默认'),
        export: exportLabel('Export', '导出')
    };

    const sectionOptions = model.sections.map((section) => `
        <label class="export-checkbox">
            <input type="checkbox" name="sectionKeys" value="${escapeHtml(section.key)}" ${sectionKeys.has(section.key) ? 'checked' : ''}>
            <span>${escapeHtml(section.title)}</span>
        </label>
    `).join('');

    const entryGroups = model.sections
        .filter((section) => section.entries.length)
        .map((section) => `
            <div class="export-entry-group">
                <p class="export-entry-group-title">${escapeHtml(section.title)}</p>
                ${section.entries.map((entry) => `
                    <label class="export-checkbox">
                        <input type="checkbox" name="entryKeys" value="${escapeHtml(entry.key)}" data-section-key="${escapeHtml(entry.sectionKey)}" ${entryKeys.has(entry.key) ? 'checked' : ''}>
                        <span>
                            ${escapeHtml(entry.title)}
                            <span class="export-entry-meta">${escapeHtml(entry.date)}</span>
                        </span>
                    </label>
                `).join('')}
            </div>
        `).join('');

    const modal = document.createElement('div');
    modal.id = 'resumeExportModal';
    modal.className = 'export-modal';
    modal.innerHTML = `
        <form class="export-dialog" id="resumeExportForm">
            <div class="export-dialog-header">
                <h2>${labels.title}</h2>
                <button class="export-close" type="button" aria-label="${labels.cancel}">&times;</button>
            </div>
            <div class="export-dialog-body">
                <div>
                    <fieldset class="export-fieldset">
                        <legend>${labels.format}</legend>
                        <label class="export-option">
                            <input type="radio" name="format" value="pdf" ${settings.format === 'pdf' ? 'checked' : ''}>
                            <span>${labels.pdf}</span>
                        </label>
                        <label class="export-option">
                            <input type="radio" name="format" value="word" ${settings.format === 'word' ? 'checked' : ''}>
                            <span>${labels.word}</span>
                        </label>
                    </fieldset>
                    <fieldset class="export-fieldset">
                        <legend>${labels.sections}</legend>
                        ${sectionOptions}
                    </fieldset>
                </div>
                <div>
                    <fieldset class="export-fieldset">
                        <legend>${labels.details}</legend>
                        <div class="export-entry-list">${entryGroups}</div>
                    </fieldset>
                    <fieldset class="export-fieldset">
                        <legend>${labels.typography}</legend>
                        ${numberControl('lineHeight', labels.lineHeight, settings.lineHeight, 0.8, 2.4, 0.02)}
                        ${numberControl('fontName', labels.fontName, settings.fontName, 8, 36, 0.1)}
                        ${numberControl('fontContact', labels.fontContact, settings.fontContact, 5, 18, 0.1)}
                        ${numberControl('fontSection', labels.fontSection, settings.fontSection, 6, 24, 0.1)}
                        ${numberControl('fontEntry', labels.fontEntry, settings.fontEntry, 6, 22, 0.1)}
                        ${numberControl('fontBody', labels.fontBody, settings.fontBody, 5, 18, 0.1)}
                        ${numberControl('fontDate', labels.fontDate, settings.fontDate, 5, 18, 0.1)}
                    </fieldset>
                </div>
                <fieldset class="export-fieldset export-preview-fieldset">
                    <legend>${labels.preview}</legend>
                    <div class="export-preview" id="resumeExportPreview"></div>
                </fieldset>
            </div>
            <div class="export-dialog-actions">
                <button class="export-action" type="button" data-action="reset">${labels.reset}</button>
                <button class="export-action" type="button" data-action="cancel">${labels.cancel}</button>
                <button class="export-action primary" type="submit">${labels.export}</button>
            </div>
        </form>
    `;

    document.body.appendChild(modal);
    updateExportPreview(modal);
    modal.querySelector('.export-close').addEventListener('click', closeExportOptions);
    modal.querySelector('[data-action="cancel"]').addEventListener('click', closeExportOptions);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeExportOptions();
    });
    modal.querySelectorAll('input').forEach((input) => {
        input.addEventListener('input', () => updateExportPreview(modal));
        input.addEventListener('change', () => updateExportPreview(modal));
    });
    modal.querySelector('[data-action="reset"]').addEventListener('click', () => {
        resumeExportSettings = null;
        openExportOptions();
    });
    modal.querySelector('#resumeExportForm').addEventListener('submit', (event) => {
        event.preventDefault();
        resumeExportSettings = readExportSettingsFromForm(modal);
        closeExportOptions();
        if (resumeExportSettings.format === 'word') {
            exportToWord(resumeExportSettings);
        } else {
            exportToPdf(resumeExportSettings);
        }
    });
}

function numberControl(name, label, value, min, max, step) {
    return `
        <label class="export-number-row">
            <span>
                ${label}
                <small>${min}-${max}</small>
            </span>
            <input type="number" name="${name}" value="${Number(value)}" min="${min}" max="${max}" step="${step}">
        </label>
    `;
}

function closeExportOptions() {
    const modal = document.getElementById('resumeExportModal');
    if (modal) modal.remove();
}

function readExportSettingsFromForm(root) {
    const readCheckedValues = (name) => Array.from(root.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
    const readNumber = (name) => {
        const input = root.querySelector(`input[name="${name}"]`);
        const value = Number(input.value);
        const min = Number(input.min);
        const max = Number(input.max);
        if (!Number.isFinite(value)) return exportDefaults[name];
        return Math.min(max, Math.max(min, value));
    };

    return {
        format: root.querySelector('input[name="format"]:checked').value,
        sectionKeys: readCheckedValues('sectionKeys'),
        entryKeys: readCheckedValues('entryKeys'),
        lineHeight: readNumber('lineHeight'),
        fontName: readNumber('fontName'),
        fontContact: readNumber('fontContact'),
        fontSection: readNumber('fontSection'),
        fontEntry: readNumber('fontEntry'),
        fontBody: readNumber('fontBody'),
        fontDate: readNumber('fontDate')
    };
}

function updateExportPreview(root) {
    const preview = root.querySelector('#resumeExportPreview');
    if (!preview) return;
    preview.innerHTML = buildExportPreviewHtml(readExportSettingsFromForm(root));
    paginateExportPreview(preview);
}

function buildExportPreviewHtml(settings) {
    const model = getExportContentModel();
    const selectedSections = new Set(settings.sectionKeys);
    const selectedEntries = new Set(settings.entryKeys);
    const headerInfo = document.querySelector('.header .info');
    const ps = headerInfo.querySelectorAll('p');
    const previewBlocks = [];

    model.sections.forEach((sectionModel) => {
        if (!selectedSections.has(sectionModel.key)) return;

        const section = sectionModel.el;
        let currentEntry = null;
        const sectionBlocks = [];

        Array.from(section.children).forEach((child) => {
            if (child.tagName === 'H2') return;

            if (child.classList.contains('h3container')) {
                currentEntry = sectionModel.entries.find((entry) => entry.heading === child);
                if (currentEntry && !selectedEntries.has(currentEntry.key)) return;
                sectionBlocks.push(`
                    <div class="export-preview-block export-preview-entry">
                        <strong>${escapeHtml(getLocalizedText(child.querySelector('h3')))}</strong>
                        <span>${escapeHtml(getLocalizedText(child.querySelector('p')))}</span>
                    </div>
                `);
                return;
            }

            if (child.tagName === 'UL') {
                if (currentEntry && !selectedEntries.has(currentEntry.key)) return;
                Array.from(child.querySelectorAll('li')).forEach((li) => {
                    sectionBlocks.push(`<p class="export-preview-block export-preview-bullet">&bull; ${escapeHtml(getLocalizedText(li))}</p>`);
                });
                currentEntry = null;
                return;
            }

            if (child.tagName === 'TABLE') {
                Array.from(child.querySelectorAll('tr')).forEach((tr) => {
                    const cells = Array.from(tr.querySelectorAll('td')).map((td) => {
                        if (td.hasAttribute('data-en')) return getLocalizedText(td);
                        return Array.from(td.querySelectorAll('[data-en]')).map((el) => getLocalizedText(el)).join(' ');
                    });
                    sectionBlocks.push(`<p class="export-preview-block export-preview-bullet">&bull; ${escapeHtml(cells.filter(Boolean).join(' | '))}</p>`);
                });
            }
        });

        if (sectionBlocks.length) {
            previewBlocks.push(`<h2 class="export-preview-block">${escapeHtml(sectionModel.title)}</h2>`);
            previewBlocks.push(...sectionBlocks);
        }
    });

    const style = [
        `--preview-name-font:${settings.fontName}pt`,
        `--preview-contact-font:${settings.fontContact}pt`,
        `--preview-section-font:${settings.fontSection}pt`,
        `--preview-entry-font:${settings.fontEntry}pt`,
        `--preview-body-font:${settings.fontBody}pt`,
        `--preview-date-font:${settings.fontDate}pt`,
        `--preview-line-height:${settings.lineHeight}`
    ].join(';');

    return `
        <div class="export-preview-page" style="${style}">
            <div class="export-preview-block export-preview-header">
                <h1>${escapeHtml(getLocalizedText(headerInfo.querySelector('h1')))}</h1>
                <p>${escapeHtml(getLocalizedText(ps[0]))}</p>
                <p>${escapeHtml(getLocalizedText(ps[1]))}</p>
                <p>${escapeHtml(getLocalizedText(ps[2]))}</p>
            </div>
            ${previewBlocks.join('') || `<p class="export-preview-block">${escapeHtml(exportLabel('No content selected.', '未选择导出内容。'))}</p>`}
        </div>
    `;
}

function paginateExportPreview(preview) {
    const sourcePage = preview.querySelector('.export-preview-page');
    if (!sourcePage) return;

    const blocks = getPreviewPageBlocks(sourcePage);
    if (blocks.length === 0) return;

    const pageStyle = sourcePage.getAttribute('style') || '';
    const sourceStyles = window.getComputedStyle(sourcePage);
    const pageHeight = sourcePage.clientHeight - parseFloat(sourceStyles.paddingTop || 0) - parseFloat(sourceStyles.paddingBottom || 0);
    const pages = [];
    let currentPage = createPreviewPage(pageStyle);
    let currentHeight = 0;

    blocks.forEach((block) => {
        const blockHeight = getPreviewBlockHeight(block);
        if (currentPage.children.length && currentHeight + blockHeight > pageHeight) {
            pages.push(currentPage);
            currentPage = createPreviewPage(pageStyle);
            currentHeight = 0;
        }
        currentPage.appendChild(block.cloneNode(true));
        currentHeight += blockHeight;
    });

    pages.push(currentPage);
    preview.innerHTML = '';
    pages.forEach((page, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'export-preview-page-wrap';
        wrapper.appendChild(page);

        if (pages.length > 1) {
            const pageLabel = document.createElement('div');
            pageLabel.className = 'export-preview-page-label';
            pageLabel.textContent = `${index + 1} / ${pages.length}`;
            wrapper.appendChild(pageLabel);
        }

        preview.appendChild(wrapper);
    });
    scaleExportPreviewPages(preview);
}

function getPreviewPageBlocks(page) {
    return Array.from(page.querySelectorAll(':scope > .export-preview-block'));
}

function getPreviewBlockHeight(block) {
    const styles = window.getComputedStyle(block);
    return block.getBoundingClientRect().height + parseFloat(styles.marginTop || 0) + parseFloat(styles.marginBottom || 0);
}

function createPreviewPage(style) {
    const page = document.createElement('div');
    page.className = 'export-preview-page';
    page.setAttribute('style', style);
    return page;
}

function scaleExportPreviewPages(preview) {
    const pageWidth = 794;
    const pageHeight = 1123;
    const availableWidth = Math.max(260, preview.clientWidth - 28);
    const scale = Math.min(1, availableWidth / pageWidth);

    preview.querySelectorAll('.export-preview-page-wrap').forEach((wrapper) => {
        wrapper.style.width = `${pageWidth * scale}px`;
        wrapper.style.marginLeft = 'auto';
        wrapper.style.marginRight = 'auto';

        const page = wrapper.querySelector('.export-preview-page');
        if (page) {
            page.style.transform = `scale(${scale})`;
        }

        const label = wrapper.querySelector('.export-preview-page-label');
        wrapper.style.height = `${pageHeight * scale + (label ? 24 : 0)}px`;
    });
}

function setExportCssVariables(settings) {
    [document.documentElement, document.body].forEach((el) => {
        el.style.setProperty('--export-name-font', `${settings.fontName}pt`);
        el.style.setProperty('--export-contact-font', `${settings.fontContact}pt`);
        el.style.setProperty('--export-section-font', `${settings.fontSection}pt`);
        el.style.setProperty('--export-entry-font', `${settings.fontEntry}pt`);
        el.style.setProperty('--export-body-font', `${settings.fontBody}pt`);
        el.style.setProperty('--export-date-font', `${settings.fontDate}pt`);
        el.style.setProperty('--export-line-height', settings.lineHeight);
    });
}

function applyExportSettingsToDom(settings) {
    setExportCssVariables(settings);
    const model = getExportContentModel();
    const selectedSections = new Set(settings.sectionKeys);
    const selectedEntries = new Set(settings.entryKeys);
    const hiddenElements = [];
    const restoredPrintHide = [];
    const hadPrintMode = document.body.classList.contains('resume-print-mode');

    document.querySelectorAll('.resume-export-hidden').forEach((el) => el.classList.remove('resume-export-hidden'));

    const showPrintHidden = (el) => {
        if (el && el.classList.contains('print-hide')) {
            el.classList.remove('print-hide');
            restoredPrintHide.push(el);
        }
    };
    const hideElement = (el) => {
        if (el) {
            el.classList.add('resume-export-hidden');
            hiddenElements.push(el);
        }
    };

    model.sections.forEach((section) => {
        if (!selectedSections.has(section.key)) {
            hideElement(section.el);
            return;
        }
        showPrintHidden(section.el);
        section.entries.forEach((entry) => {
            if (!selectedEntries.has(entry.key)) {
                hideElement(entry.heading);
                hideElement(entry.detail);
                return;
            }
            showPrintHidden(entry.heading);
            showPrintHidden(entry.detail);
        });
    });

    document.body.classList.add('resume-print-mode');
    document.body.classList.add('export-printing');

    return () => {
        hiddenElements.forEach((el) => el.classList.remove('resume-export-hidden'));
        restoredPrintHide.forEach((el) => el.classList.add('print-hide'));
        document.body.classList.remove('export-printing');
        if (!hadPrintMode) {
            document.body.classList.remove('resume-print-mode');
        }
    };
}

function exportToPdf(settings = getActiveExportSettings()) {
    const cleanup = applyExportSettingsToDom(settings);
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
}

function exportToWord(settings = getActiveExportSettings()) {
    if (isEditMode) {
        syncBilingualAttrsFromCurrentView();
    }

    setExportCssVariables(settings);
    const isChinese = pageIsChinese();
    const selectedSections = new Set(settings.sectionKeys);
    const selectedEntries = new Set(settings.entryKeys);
    const model = getExportContentModel();
    const entryByHeading = new Map(model.entries.map((entry) => [entry.heading, entry]));
    const get = (el) => escapeHtml(getLocalizedText(el));

    const headerInfo = document.querySelector('.header .info');
    const name = get(headerInfo.querySelector('h1'));
    const ps = headerInfo.querySelectorAll('p');
    const contact = get(ps[0]);
    const address = get(ps[1]);
    const interests = get(ps[2]);
    const linePt = (fontSize, multiplier = 1) => (fontSize * settings.lineHeight * multiplier).toFixed(2);
    const bodyLine = linePt(settings.fontBody);
    const contactLine = linePt(settings.fontContact);
    const nameLine = linePt(settings.fontName, 1.05);
    const sectionLine = linePt(settings.fontSection, 1.05);
    const entryLine = linePt(settings.fontEntry, 1.05);

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
  body { font-family: Arial, sans-serif; font-size: ${settings.fontBody}pt; line-height: ${bodyLine}pt; mso-line-height-rule: exactly; color: #000; margin: 0; padding: 4pt 19pt; }
  .header-wrap { margin-bottom: 4pt; }
  h1 { font-size: ${settings.fontName}pt; line-height: ${nameLine}pt; mso-line-height-rule: exactly; text-align: center; margin: 0 0 3pt 0; }
  .contact-line { text-align: center; font-size: ${settings.fontContact}pt; line-height: ${contactLine}pt; mso-line-height-rule: exactly; margin: 1pt 0; }
  h2 { font-size: ${settings.fontSection}pt; line-height: ${sectionLine}pt; mso-line-height-rule: exactly; border-bottom: 1pt solid #000; margin: 6pt 0 3pt 0; padding-bottom: 0; }
  .entry-table { width: 100%; margin: 2pt 0 1pt 0; }
  .entry-table td { padding: 0; }
  .entry-table .title-left { text-align: left; font-size: ${settings.fontEntry}pt; line-height: ${entryLine}pt; mso-line-height-rule: exactly; font-weight: bold; }
  .entry-table .title-right { text-align: right; font-size: ${settings.fontDate}pt; line-height: ${linePt(settings.fontDate, 1.05)}pt; mso-line-height-rule: exactly; white-space: nowrap; }
  .bullet-item { margin: 0.5pt 0 0.5pt 15pt; font-size: ${settings.fontBody}pt; line-height: ${bodyLine}pt; mso-line-height-rule: exactly; }
  .skill-item { margin: 0.5pt 0 0.5pt 7.5pt; font-size: ${settings.fontBody}pt; line-height: ${bodyLine}pt; mso-line-height-rule: exactly; }
  .data-table { width: 100%; margin: 1pt 0; }
  .data-table td { padding: 1pt 4pt; font-size: ${settings.fontBody}pt; line-height: ${bodyLine}pt; mso-line-height-rule: exactly; vertical-align: top; }
  .data-table td:first-child { padding-left: 7.5pt; }
  p { mso-margin-top-alt: 0pt; mso-margin-bottom-alt: 0pt; }
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

    model.sections.forEach((sectionModel) => {
        const section = sectionModel.el;
        if (!selectedSections.has(sectionModel.key)) return;

        const h2 = section.querySelector('h2');
        if (!h2) return;
        html += `<h2>${get(h2)}</h2>\n`;

        let currentEntry = null;
        Array.from(section.children).forEach((child) => {
            if (child.tagName === 'H2') return;

            if (child.classList.contains('h3container')) {
                currentEntry = entryByHeading.get(child);
                if (currentEntry && !selectedEntries.has(currentEntry.key)) return;
                const h3 = child.querySelector('h3');
                const p = child.querySelector('p');
                html += `<table class="entry-table" border="0" cellpadding="0" cellspacing="0"><tr><td class="title-left">${get(h3)}</td><td class="title-right">${get(p)}</td></tr></table>\n`;
            } else if (child.tagName === 'UL') {
                if (currentEntry && !selectedEntries.has(currentEntry.key)) return;
                const itemClass = section.id === 'skills' ? 'skill-item' : 'bullet-item';
                child.querySelectorAll('li').forEach((li) => {
                    html += `<p class="${itemClass}">\u2022  ${get(li)}</p>\n`;
                });
                currentEntry = null;
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
                                    text += escapeHtml(node.textContent);
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
        openExportOptions();
    }
});

const exportWordButton = document.getElementById('exportWord');
if (exportWordButton) {
    exportWordButton.addEventListener('click', openExportOptions);
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
