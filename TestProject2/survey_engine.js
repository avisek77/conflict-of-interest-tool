class SurveyEngine {
    constructor() {
        this.surveyConfig = null;
        this.answers = JSON.parse(localStorage.getItem('surveyAnswers')) || {};
        this.sectionCards = []; // { section, el, index, visible }
        console.log('SurveyEngine (cards) initialized');
        this.initialize();
    }

    async initialize() {
        try {
            await this.loadSurveyConfig();
            if (!this.surveyConfig) throw new Error('Survey configuration not found');
            this.renderSections();
            this.evaluateAllVisibility(); // sets which sections should exist & which questions visible
            this.restoreUIState();
            this.setupEventListeners();
            this.updateProgress();
            this.setupCompletionButton();
            this.checkAndShowCompletionButton();
        } catch (err) {
            console.error('Initialization failed:', err);
            this.showError(err.message);
        }
    }

    async loadSurveyConfig() {
        try {
            const resp = await fetch('main.JSON');
            if (!resp.ok) throw new Error(`Failed to load survey config (${resp.status})`);
            this.surveyConfig = await resp.json();
        } catch (error) {
            console.error('Failed to load survey config', error);
            this.surveyConfig = null;
        }
    }

    showError(message) {
        const container = document.getElementById('sections-container');
        if (container) {
            container.innerHTML = `<div class="error-message"><h3>Error</h3><p>${message}</p></div>`;
        }
    }

    /*************** Rendering ***************/
    renderSections() {
        const container = document.getElementById('sections-container');
        if (!container) return;
        container.innerHTML = '';
        this.sectionCards = [];

        (this.surveyConfig.questions || []).forEach((section, idx) => {
            const card = document.createElement('div');
            card.className = 'section-card';
            card.dataset.sectionId = section.id;

            // Collapse toggle (button) added to header
            const header = document.createElement('div');
            header.className = 'card-header';
            header.innerHTML = `
                <h2>${section.title || section.id}</h2>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="section-status"><span class="section-complete-hint">Incomplete</span></span>
                    <button class="collapse-toggle" aria-expanded="true" title="Collapse section">−</button>
                </div>
            `;

            const content = document.createElement('div');
            content.className = 'card-content';
            content.dataset.sectionId = section.id;

            // create question HTML inside content
            const items = section.items || [];
            items.forEach(item => {
                content.insertAdjacentHTML('beforeend', this.createQuestionHTML(item));
            });

            card.appendChild(header);
            card.appendChild(content);
            container.appendChild(card);

            this.sectionCards.push({
                section,
                el: card,
                contentEl: content,
                headerEl: header,
                index: idx,
                visible: true // will be re-evaluated below
            });
        });
    }


    createQuestionHTML(question) {
        // NOTE: we intentionally avoid inline handlers and use delegated event listeners
        switch (question.type) {
            case 'text':
                return `
                <div class="form-group question-item" data-question-id="${question.id}" data-question-type="text">
                    <label for="${question.id}">${question.text}${question.required ? ' *' : ''}</label>
                    <input type="text" id="${question.id}" name="${question.id}" value="${this.escape(this.answers[question.id] || '')}">
                    ${question.help ? `<p class="help-text">${question.help}</p>` : ''}
                </div>`;
            case 'textarea':
                return `
                <div class="form-group question-item" data-question-id="${question.id}" data-question-type="textarea">
                    <label for="${question.id}">${question.text}${question.required ? ' *' : ''}</label>
                    <textarea id="${question.id}" name="${question.id}">${this.escape(this.answers[question.id] || '')}</textarea>
                    ${question.help ? `<p class="help-text">${question.help}</p>` : ''}
                </div>`;
            case 'date':
                return `
                <div class="form-group question-item" data-question-id="${question.id}" data-question-type="date">
                    <label for="${question.id}">${question.text}${question.required ? ' *' : ''}</label>
                    <input type="date" id="${question.id}" name="${question.id}" value="${this.escape(this.answers[question.id] || '')}">
                    ${question.help ? `<p class="help-text">${question.help}</p>` : ''}
                </div>`;
            case 'checkbox':
                {
                    const checked = (this.answers[question.id] === true || this.answers[question.id] === 'true') ? 'checked' : '';
                    return `
                    <div class="form-group question-item" data-question-id="${question.id}" data-question-type="checkbox">
                        <label class="checkbox-label">
                            <input type="checkbox" id="${question.id}" name="${question.id}" ${checked}>
                            ${question.text}${question.required ? ' *' : ''}
                        </label>
                        ${question.help ? `<p class="help-text">${question.help}</p>` : ''}
                    </div>`;
                }
            case 'yesno':   
                {
                    const options = question.options || [{label:'Yes',value:'1'},{label:'No',value:'2'}];
                    const current = this.answers[question.id] || '';
                    const opts = options.map(o => `
                        <label>
                        <input type="radio" name="${question.id}" value="${o.value}" ${current == o.value ? 'checked' : ''}>
                        ${o.label}
                        </label>
                    `).join('');

                    const legendId = `${question.id}-label`;

                    return `
                    <div class="form-group question-item" data-question-id="${question.id}" data-question-type="yesno" role="group" aria-labelledby="${legendId}">
                        <div id="${legendId}" class="yesno-legend">${question.text}${question.required ? ' *' : ''}</div>
                        <div class="options-container" role="radiogroup" aria-labelledby="${legendId}">${opts}</div>
                        ${question.help ? `<p class="help-text">${question.help}</p>` : ''}
                    </div>`;
                }

            case 'subheader':
                return `
                <div class="sub-section-header question-item" data-question-id="${question.id}" data-question-type="subheader">
                    <h3>${question.text}</h3>
                </div>`;
            case 'info':
                return `
                <div class="info-display question-item" data-question-id="${question.id}" data-question-type="info">
                    <p>${question.text}</p>
                </div>`;
            default:
                return `<div class="question-item"><p>Unknown question type: ${this.escape(String(question.type))}</p></div>`;
        }
    }

    escape(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    /*************** Logic evaluation ***************/
    getSectionById(id) {
        return this.surveyConfig.questions.find(s => s.id === id);
    }

    evaluateCondition(condition) {
        if (!condition) return false;
        // condition can be either {questionId, operator, value} or with type+clauses
        if (condition.type) {
            if (condition.type === 'AND') {
                return condition.clauses.every(c => this.evaluateCondition(c));
            } else if (condition.type === 'OR') {
                return condition.clauses.some(c => this.evaluateCondition(c));
            } else {
                // fallback to evaluating as single condition
            }
        }

        const answer = this.answers[condition.questionId];
        switch (condition.operator) {
            case 'equals':
                return answer == condition.value;
            case 'not_equals':
                return answer != condition.value;
            default:
                return false;
        }
    }

    isSectionVisible(section) {
        if (!section.logic || !section.logic.condition) return true;
        return this.evaluateCondition(section.logic.condition);
    }

    isQuestionVisible(question) {
        if (!question.logic || !question.logic.condition) return true;
        return this.evaluateCondition(question.logic.condition);
    }

    /*************** Visibility and completion ***************/
    evaluateAllVisibility() {
        // Track which questions should be visible
        const visibleQuestionIds = new Set();

        this.sectionCards.forEach(card => {
            const section = card.section;
            const sectionVisible = this.isSectionVisible(section);
            card.visible = sectionVisible;
            
            if (!sectionVisible) {
                card.el.classList.add('hidden');
                // Clear answers for all questions in hidden sections
                const items = section.items || [];
                items.forEach(item => {
                    delete this.answers[item.id];
                });
                return;
            }
            
            card.el.classList.remove('hidden');

            // Evaluate each question's visibility
            const items = section.items || [];
            items.forEach(item => {
                const questionEl = card.contentEl.querySelector(`[data-question-id="${item.id}"]`);
                if (!questionEl) return;
                
                const shouldBeVisible = this.isQuestionVisible(item);
                
                if (shouldBeVisible) {
                    questionEl.style.display = '';
                    visibleQuestionIds.add(item.id);
                    // Auto-grow textarea if needed
                    if (item.type === 'textarea') {
                        const textarea = questionEl.querySelector('textarea');
                        if (textarea) this.autoGrowTextarea(textarea);
                    }
                } else {
                    questionEl.style.display = 'none';
                    // CLEAR THE ANSWER WHEN QUESTION BECOMES HIDDEN
                    delete this.answers[item.id];
                }
            });
        });

        // Save the updated answers
        localStorage.setItem('surveyAnswers', JSON.stringify(this.answers));
        
        // Update UI state
        this.sectionCards.forEach(card => this.updateSectionHeader(card));
        this.revealFirstUnrevealedSection();
        this.updateProgress();
        this.checkAndShowCompletionButton();
    }

    isSectionComplete(card) {
        const section = card.section;
        const items = section.items || [];
        // for each visible question, if required then it must have an answer
        for (const item of items) {
            const qEl = card.contentEl.querySelector(`[data-question-id="${item.id}"]`);
            if (!qEl) continue;
            if (qEl.style.display === 'none') continue; // not visible due to logic
            if (item.type === 'info' || item.type === 'subheader') continue; // info/subheader always considered satisfied
            if (!item.required) continue; // not required
            const stored = this.answers[item.id];
            // evaluate requiredness depending on type
            if (item.type === 'checkbox') {
                if (!(stored === true || stored === 'true')) return false;
            } else {
                if (stored === undefined || stored === null || String(stored).trim() === '') return false;
            }
        }
        return true;
    }

    revealFirstUnrevealedSection() {
        // find first visible section that's not revealed
        for (let i = 0; i < this.sectionCards.length; i++) {
            const card = this.sectionCards[i];
            if (!card.visible) continue;
            if (!card.el.classList.contains('revealed')) {
                // only reveal this one if all previous visible sections are complete
                let prevComplete = true;
                for (let j = 0; j < i; j++) {
                    const prev = this.sectionCards[j];
                    if (!prev.visible) continue;
                    if (!this.isSectionComplete(prev)) { prevComplete = false; break; }
                }
                if (prevComplete) {
                    this.revealSection(card);
                }
                break;
            }
        }
    }

    revealSection(card) {
        if (!card || !card.visible) return;
        card.el.classList.add('revealed');
        // mark header hint if complete already
        this.updateSectionHeader(card);

        // scroll the card into view smoothly
        card.el.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Auto-grow all textareas in the revealed section
        card.el.querySelectorAll('textarea').forEach(textarea => {
            this.autoGrowTextarea(textarea);
        });
    }

    updateSectionHeader(card) {
        const hint = card.headerEl.querySelector('.section-complete-hint');
        if (!hint) return;
        if (this.isSectionComplete(card)) {
            hint.textContent = 'Complete';
            card.el.classList.add('completed');
        } else {
            hint.textContent = 'Incomplete';
            card.el.classList.remove('completed');
        }
    }

    restoreUIState() {
        // reveal the first visible section by default (or any earlier ones that are already revealed in local state)
        // We'll reveal sequentially: if earlier sections are already complete reveal next etc.
        this.sectionCards.forEach(c => c.el.classList.remove('revealed','completed'));
        // Evaluate and reveal in order based on completion
        for (let i = 0; i < this.sectionCards.length; i++) {
            const card = this.sectionCards[i];
            if (!card.visible) continue;
            // reveal the card if it's the first un-revealed but all previous visible are complete
            let allPrevComplete = true;
            for (let j = 0; j < i; j++) {
                const prev = this.sectionCards[j];
                if (!prev.visible) continue;
                if (!this.isSectionComplete(prev)) { allPrevComplete = false; break; }
            }
            if (allPrevComplete) {
                // reveal this card (and continue loop — this will reveal a contiguous run from start)
                card.el.classList.add('revealed');
                this.updateSectionHeader(card);
            } else {
                // can't reveal later sections
                break;
            }
        }

        // Auto-grow all textareas after restoring state
        document.querySelectorAll('textarea').forEach(textarea => {
            this.autoGrowTextarea(textarea);
        });

        this.checkAndShowCompletionButton();
    }

    /*************** Textarea Auto-Grow ***************/
    autoGrowTextarea(element) {
        // Temporarily set height to 0 to calculate the necessary scrollHeight accurately
        element.style.height = '0px'; 
        // Set height to scrollHeight (the height of the content) plus a small buffer
        element.style.height = (element.scrollHeight + 2) + 'px';
    }


    /*************** Events and saving ***************/
    setupEventListeners() {
        // delegate input and change events to the container
        const container = document.getElementById('sections-container');
        if (!container) return;

        container.addEventListener('input', (e) => {
            this.handleInputChange(e.target);
            // Also check if the input is a textarea for auto-grow
            if (e.target.tagName === 'TEXTAREA') {
                this.autoGrowTextarea(e.target);
            }
        });

        container.addEventListener('change', (e) => {
            this.handleInputChange(e.target);
        });

        // collapse/expand toggle (delegated)
        container.addEventListener('click', (e) => {
            const toggle = e.target.closest('.collapse-toggle');
            if (!toggle) return;

            const card = toggle.closest('.section-card');
            if (!card) return;

            const expanded = toggle.getAttribute('aria-expanded') === 'true';
            if (expanded) {
                // collapse
                card.classList.add('collapsed');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.textContent = '+';
            } else {
                // expand
                card.classList.remove('collapsed');
                toggle.setAttribute('aria-expanded', 'true');
                toggle.textContent = '−';
                // scroll it into view so user sees opened content
                card.scrollIntoView({ behavior: 'smooth', block: 'start' });

                // Auto-grow textareas when expanding
                card.querySelectorAll('textarea').forEach(textarea => {
                    this.autoGrowTextarea(textarea);
                });
            }
        });
    }

    handleInputChange(target) {
        if (!target || !target.name) return;
        const qid = target.name;
        let value;
        if (target.type === 'checkbox') {
            value = target.checked;
        } else if (target.type === 'radio') {
            // find checked radio for that name
            const checked = document.querySelector(`[name="${qid}"]:checked`);
            value = checked ? checked.value : null;
        } else {
            value = target.value;
        }

        // trim strings
        if (typeof value === 'string') value = value.trim();

        if (value === null || value === '' || value === false) {
            // delete the answer to keep storage clean
            delete this.answers[qid];
        } else {
            this.answers[qid] = value;
        }

        localStorage.setItem('surveyAnswers', JSON.stringify(this.answers));
        // re-evaluate logic-driven visibility and section completion
        this.evaluateAllVisibility();
        // update headers and reveal next sections if applicable
        this.sectionCards.forEach(card => this.updateSectionHeader(card));
        this.revealFirstUnrevealedSection();
        this.updateProgress();
        // show completion button
        this.checkAndShowCompletionButton();
    }

    /*************** Progress ***************/
    updateProgress() {
        // progress equals number of completed visible sections / number of visible sections
        const visible = this.sectionCards.filter(c => c.visible);
        const completed = visible.filter(c => this.isSectionComplete(c)).length;
        const pct = visible.length ? Math.round((completed / visible.length) * 100) : 0;
        const fill = document.getElementById('progress-fill');
        if (fill) fill.style.width = `${pct}%`;

        const text = document.getElementById('progress-text');
        if (text) text.textContent = visible.length ? `Sections complete: ${completed} of ${visible.length}` : 'No sections';
    }

    /*************** Completion ***************/
    setupCompletionButton() {
        const container = document.getElementById('sections-container');
        if (!container) return;
        
        // Remove existing button if any
        const existingButton = document.getElementById('complete-survey-button');
        if (existingButton) existingButton.remove();
        
        const button = document.createElement('button');
        button.id = 'complete-survey-button';
        button.className = 'complete-survey-button hidden';
        button.textContent = 'Complete Survey ➝';
        button.addEventListener('click', () => {
            localStorage.setItem('surveyCompleted', 'true');
            window.location.href = 'end_page.html';
        });
        
        container.parentNode.insertBefore(button, container.nextSibling);
    }

    checkAndShowCompletionButton() {
        const visibleCards = this.sectionCards.filter(card => card.visible);
        const allComplete = visibleCards.length > 0 && 
                            visibleCards.every(card => this.isSectionComplete(card));
        
        const button = document.getElementById('complete-survey-button');
        if (button) {
            if (allComplete) {
                button.classList.remove('hidden');
            } else {
                button.classList.add('hidden');
            }
        }
    }
}

// init
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing survey engine (cards)...');
    window.surveyEngine = new SurveyEngine();
});
