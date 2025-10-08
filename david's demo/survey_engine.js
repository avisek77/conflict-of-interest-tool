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
            this.cleanupInvalidData();
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
                    <span class="section-status">
                        <span class="section-complete-hint section-status-incomplete">Incomplete</span>
                    </span>
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

    // START: Updated createQuestionHTML with Help Icon Logic
    createQuestionHTML(question) {
        // Helper function to generate the icon HTML
        const getHelpIcon = (id, help) => help ? `
            <span class="help-icon-container" data-help-target="${id}">
                <img src="QuestionMark.png" alt="Help" class="help-icon">
            </span>` : '';

        // Helper function to generate the help text HTML
        const getHelpText = (id, help) => help ? `<p class="help-text" id="help-${id}">${question.help}</p>` : '';

        switch (question.type) {
            case 'text':
                const textValue = this.answers[question.id] || '';
                const textClass = textValue && textValue.toString().trim() !== '' ? 'has-content' : '';
                return `
                <div class="form-group question-item" data-question-id="${question.id}" data-question-type="text">
                    <label for="${question.id}">${question.text}${question.required ? ' *' : ''}${getHelpIcon(question.id, question.help)}</label>
                    <input type="text" id="${question.id}" name="${question.id}" value="${this.escape(textValue)}" class="${textClass}" ${question.required ? 'required' : ''}>
                    ${getHelpText(question.id, question.help)}
                </div>`;
            case 'textarea':
                const textareaValue = this.answers[question.id] || '';
                const textareaClass = textareaValue && textareaValue.toString().trim() !== '' ? 'has-content' : '';
                return `
                <div class="form-group question-item" data-question-id="${question.id}" data-question-type="textarea">
                    <label for="${question.id}">${question.text}${question.required ? ' *' : ''}${getHelpIcon(question.id, question.help)}</label>
                    <textarea id="${question.id}" name="${question.id}" class="${textareaClass}" ${question.required ? 'required' : ''}>${this.escape(textareaValue)}</textarea>
                    ${getHelpText(question.id, question.help)}
                </div>`;
            case 'date':
                const dateValue = this.answers[question.id] || '';
                const dateClass = dateValue && dateValue.toString().trim() !== '' ? 'has-content' : '';
                return `
                <div class="form-group question-item" data-question-id="${question.id}" data-question-type="date">
                    <label for="${question.id}">${question.text}${question.required ? ' *' : ''}${getHelpIcon(question.id, question.help)}</label>
                    <input type="date" id="${question.id}" name="${question.id}" value="${this.escape(dateValue)}" class="${dateClass}" ${question.required ? 'required' : ''}>
                    ${getHelpText(question.id, question.help)}
                </div>`;
            case 'checkbox':
                {
                    const checked = (this.answers[question.id] === true || this.answers[question.id] === 'true') ? 'checked' : '';
                    return `
                    <div class="form-group question-item" data-question-id="${question.id}" data-question-type="checkbox">
                        <label class="checkbox-label">
                            <input type="checkbox" id="${question.id}" name="${question.id}" ${checked}>
                            ${question.text}${question.required ? ' *' : ''}${getHelpIcon(question.id, question.help)}
                        </label>
                        ${getHelpText(question.id, question.help)}
                    </div>`;
                }
            case 'yesno':
                {
                    const options = question.options || [{label:'Yes',value:'1'},{label:'No',value:'2'}];
                    const current = this.answers[question.id] || '';
                    const isValid = current === '1' || current === '2' || current === '';
                    
                    const opts = options.map(o => `
                        <label class="custom-radio-label">
                        <input type="radio" name="${question.id}" value="${o.value}" ${current == o.value ? 'checked' : ''}>
                        <span class="custom-radio-button"></span>
                        ${o.label}
                        </label>
                    `).join('');

                    const legendId = `${question.id}-label`;

                    return `
                    <div class="form-group question-item" data-question-id="${question.id}" data-question-type="yesno" role="group" aria-labelledby="${legendId}">
                        <div id="${legendId}" class="yesno-legend">${question.text}${question.required ? ' *' : ''}${getHelpIcon(question.id, question.help)}</div>
                        <div class="options-container ${!isValid ? 'invalid' : ''}" role="radiogroup" aria-labelledby="${legendId}">${opts}</div>
                        ${!isValid ? `<p class="error-message">Please select either Yes or No</p>` : ''}
                        ${getHelpText(question.id, question.help)}
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
    // END: Updated createQuestionHTML with Help Icon Logic

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
                    
                    // When question becomes visible again, sync DOM with current answers
                    this.syncQuestionDOM(item, questionEl);
                    
                    // Auto-grow textarea if needed
                    if (item.type === 'textarea') {
                        const textarea = questionEl.querySelector('textarea');
                        if (textarea) this.autoGrowTextarea(textarea);
                    }
                } else {
                    questionEl.style.display = 'none';
                    // CLEAR THE ANSWER WHEN QUESTION BECOMES HIDDEN
                    delete this.answers[item.id];
                    // Also reset the DOM element immediately
                    this.resetQuestionDOM(item, questionEl);
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

    /* Syncs the DOM element with the current answer state */
    syncQuestionDOM(item, questionEl) {
        const currentAnswer = this.answers[item.id];
        
        switch (item.type) {
            case 'text':
            case 'date':
                const input = questionEl.querySelector('input');
                if (input) {
                    input.value = currentAnswer || '';
                    this.updateContentClass(input);
                }
                break;
            case 'textarea':
                const textarea = questionEl.querySelector('textarea');
                if (textarea) {
                    textarea.value = currentAnswer || '';
                    this.updateContentClass(textarea);
                    this.autoGrowTextarea(textarea);
                }
                break;
            case 'checkbox':
                const checkbox = questionEl.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = currentAnswer === true || currentAnswer === 'true';
                    this.updateContentClass(checkbox);
                }
                break;
            case 'yesno':
                const radios = questionEl.querySelectorAll('input[type="radio"]');
                radios.forEach(radio => {
                    radio.checked = radio.value === currentAnswer;
                    this.updateContentClass(radio);
                });
                break;
        }
    }

    /* Resets the DOM element when question becomes hidden */
    resetQuestionDOM(item, questionEl) {
        switch (item.type) {
            case 'text':
            case 'date':
                const input = questionEl.querySelector('input');
                if (input) {
                    input.value = '';
                    input.classList.remove('has-content');
                    input.classList.remove('touched');
                }
                break;
            case 'textarea':
                const textarea = questionEl.querySelector('textarea');
                if (textarea) {
                    textarea.value = '';
                    textarea.classList.remove('has-content');
                    textarea.classList.remove('touched');
                    this.autoGrowTextarea(textarea); // Reset height
                }
                break;
            case 'checkbox':
                const checkbox = questionEl.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = false;
                    checkbox.classList.remove('has-content');
                    checkbox.classList.remove('touched');
                }
                break;
            case 'yesno':
                const radios = questionEl.querySelectorAll('input[type="radio"]');
                radios.forEach(radio => {
                    radio.checked = false;
                    radio.classList.remove('has-content');
                    radio.classList.remove('touched');
                });
                // Ensure help text is hidden on reset
                const helpTextEl = document.getElementById(`help-${item.id}`);
                if (helpTextEl) helpTextEl.classList.remove('active');
                break;
        }
        // Ensure help text is hidden on reset for all types
        const helpTextEl = document.getElementById(`help-${item.id}`);
        if (helpTextEl) helpTextEl.classList.remove('active');
    }

    isSectionComplete(card) {
        const section = card.section;
        const items = section.items || [];
        
        for (const item of items) {
            const qEl = card.contentEl.querySelector(`[data-question-id="${item.id}"]`);
            if (!qEl) continue;
            if (qEl.style.display === 'none') continue; // not visible due to logic
            if (item.type === 'info' || item.type === 'subheader') continue; // info/subheader always considered satisfied
            if (!item.required) continue; // not required
            
            const stored = this.answers[item.id];
            
            // Enhanced validation based on question type
            if (item.type === 'checkbox') {
                if (!(stored === true || stored === 'true')) return false;
            } else if (item.type === 'yesno') {
                // Validate yesno questions only accept "1" or "2"
                if (stored !== '1' && stored !== '2') return false;
            } else {
                // For text/textarea/date, check it's not empty
                if (stored === undefined || stored === null || String(stored).trim() === '') return false;
            }
        }
        return true;
    }

    validateInputValue(questionId, value, questionType) {
        if (questionType === 'yesno') {
            // Only allow "1" or "2" for yesno questions
            if (value !== '1' && value !== '2') {
                console.warn(`Invalid value for yesno question ${questionId}: ${value}`);
                return false;
            }
        }
        return true;
    }

    cleanupInvalidData() {
        const yesNoFields = ['NewAffectingOld', 'OldAffectingNew', 'DisclosureChoiceYN', 
                             'ModificChoiceYN', 'MonitorChoiceYN', 'HarmMgmtChoiceYN', 
                             'OtherChoiceYN', 'EliminationChoiceYN', 'PotentialYN', 
                             'PerceivedYN', 'Keep'];
        
        let cleaned = false;
        
        yesNoFields.forEach(field => {
            if (this.answers[field] && this.answers[field] !== '1' && this.answers[field] !== '2') {
                console.log(`Cleaning invalid value for ${field}: ${this.answers[field]}`);
                delete this.answers[field];
                cleaned = true;
            }
        });
        
        if (cleaned) {
            localStorage.setItem('surveyAnswers', JSON.stringify(this.answers));
        }
    }

    handleInputChange(target) {
        if (!target || !target.name) return;
        const qid = target.name;
        
        // Find the question type
        const questionEl = target.closest('.question-item');
        const questionType = questionEl ? questionEl.dataset.questionType : null;
        
        let value;
        if (target.type === 'checkbox') {
            value = target.checked;
        } else if (target.type === 'radio') {
            const checked = document.querySelector(`[name="${qid}"]:checked`);
            value = checked ? checked.value : null;
        } else {
            value = target.value;
        }

        // Validate the input
        if (!this.validateInputValue(qid, value, questionType)) {
            // Invalid input - don't save and show error state
            target.classList.add('invalid-input');
            return;
        }
        
        // Remove error state if valid
        target.classList.remove('invalid-input');
        
        // Preserve internal and trailing spaces while the user types.
        if (typeof value === 'string') {
            if (value.trim() === '') {
                // convert pure-whitespace to empty string so we don't store "    "
                value = '';
            }
            // otherwise keep the user's spaces exactly as typed (don't .trim())
        }

        if (value === null || value === '' || value === false) {
            // delete the answer to keep storage clean
            delete this.answers[qid];
        } else {
            this.answers[qid] = value;
        }

        localStorage.setItem('surveyAnswers', JSON.stringify(this.answers));
        this.evaluateAllVisibility();
        this.sectionCards.forEach(card => this.updateSectionHeader(card));
        this.revealFirstUnrevealedSection();
        this.updateProgress();
        this.checkAndShowCompletionButton();
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
            hint.classList.remove('section-status-incomplete');
            hint.classList.add('section-status-complete');
            card.el.classList.add('completed');
        } else {
            hint.textContent = 'Incomplete';
            hint.classList.remove('section-status-complete');
            hint.classList.add('section-status-incomplete');
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

        // Initialize content classes for all inputs
        document.querySelectorAll('input, textarea').forEach(input => {
            this.updateContentClass(input);
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
            // Update the has-content class for text inputs and textareas
            this.updateContentClass(e.target);
        });

        container.addEventListener('change', (e) => {
            this.handleInputChange(e.target);
            // Update the has-content class for radio buttons and checkboxes
            this.updateContentClass(e.target);
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

        // START: NEW CLICK HANDLER FOR THE HELP ICON
        container.addEventListener('click', (e) => {
            const iconContainer = e.target.closest('.help-icon-container');
            if (!iconContainer) return;

            e.preventDefault(); 
            e.stopPropagation(); // Stop propagation to prevent collapsing the card if icon is in the header

            // Get the question ID from the container's data attribute
            const qid = iconContainer.dataset.helpTarget;
            const helpTextEl = document.getElementById(`help-${qid}`);

            if (helpTextEl) {
                // Toggle the 'active' class to show/hide the text
                helpTextEl.classList.toggle('active');
                // Close other help texts if open (optional but helpful)
                document.querySelectorAll('.help-text.active').forEach(el => {
                    if (el.id !== `help-${qid}`) {
                        el.classList.remove('active');
                    }
                });
            }
        });
        // END: NEW CLICK HANDLER FOR THE HELP ICON

        // Optional: trim on blur to normalise stored answers (keeps live typing behaviour,
        // but removes accidental leading/trailing spaces when user leaves the field)
        container.addEventListener('blur', (e) => {
            const t = e.target;
            if (!t || !t.name) return;
            if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') {
                if (typeof t.value === 'string') {
                    const trimmed = t.value.trim();
                    if (trimmed !== t.value) {
                        // update the visible DOM value to the trimmed version
                        t.value = trimmed;
                        // propagate trimmed value to answers via input event
                        const ev = new Event('input', { bubbles: true });
                        t.dispatchEvent(ev);
                    }
                }
            }
        }, true); // use capture so blur is caught on inputs inside container

        // Mark fields as touched on user focus (so we only show validation styling after interaction)
        container.addEventListener('focusin', (e) => {
            const t = e.target;
            if (!t) return;
            if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') {
                t.classList.add('touched');
            }
            // For radio/checkbox, mark the closest question-item as touched
            const questionItem = t.closest('.question-item');
            if (questionItem) {
                questionItem.classList.add('touched');
            }
        });
    }

    /* Updates the has-content class based on input value */
    updateContentClass(target) {
        if (!target) return;
        
        if (target.type === 'text' || target.type === 'textarea' || target.type === 'date') {
            if (target.value && target.value.trim() !== '') {
                target.classList.add('has-content');
            } else {
                target.classList.remove('has-content');
            }
        } else if (target.type === 'checkbox') {
            if (target.checked) {
                target.classList.add('has-content');
            } else {
                target.classList.remove('has-content');
            }
        } else if (target.type === 'radio') {
            // For radio groups, update all radios in the same group
            const radios = document.querySelectorAll(`[name="${target.name}"]`);
            radios.forEach(radio => {
                if (radio.checked) {
                    radio.classList.add('has-content');
                } else {
                    radio.classList.remove('has-content');
                }
            });
        }
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
                button.removeAttribute('disabled');
            } else {
                button.classList.add('hidden');
                button.setAttribute('disabled', 'true');
            }
        }
    }
} // End of class SurveyEngine

// Instantiate the class to start the survey
document.addEventListener('DOMContentLoaded', () => {
    window.surveyEngine = new SurveyEngine();
});