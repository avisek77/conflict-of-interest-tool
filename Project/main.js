// --- Autosize Textarea Logic - FOR TEXTBOXES ---t
document.addEventListener('DOMContentLoaded', function () {
  const textareas = document.querySelectorAll('textarea');
  const resizeTextarea = (textarea) => {

    // Reset height to 'auto' to correctly calculate the new height
    textarea.style.height = 'auto';

    // Set the height to the scroll height, which is the height of the content
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  // Loop through all textareas and add an input event listener
  textareas.forEach(textarea => {
    textarea.addEventListener('input', () => {
      resizeTextarea(textarea);
    });

    // Also call the resize function once on page load to handle pre-filled content
    resizeTextarea(textarea);
  });

  // --- "I Accept" Checkbox Logic for G-0.html ---
  const checkbox = document.getElementById('Terms_And_Conditions_Checkbox');
  const nextButton = document.getElementById('next-button');

  // This logic only applies to the G-0.html page, so we check for the elements
  if (checkbox && nextButton) {
    // Initially disable the button if the checkbox is not checked on load
    nextButton.disabled = !checkbox.checked;

    // Add an event listener to the checkbox to toggle the button's disabled state
    checkbox.addEventListener('change', function () {
      nextButton.disabled = !this.checked;
    });

    // Add a click event listener to the button to handle navigation
    nextButton.addEventListener('click', function () {
      // Navigate only if the button is not disabled
      if (!this.disabled) {
        window.location.href = 'G-1.html';
      }
    });
  }
  const form = document.getElementById("g3-form");
if (form) { // Only run if this page has the form
  function updateConditionalQuestions() {
    const conditionalQuestions = document.querySelectorAll(".conditional-question");
    const noConflictNote = document.getElementById("no-conflict-note");

    // Check selected values for Q2.1 and Q2.2
    const q2_1 = form.querySelector('input[name="q2_1"]:checked')?.value;
    const q2_2 = form.querySelector('input[name="q2_2"]:checked')?.value;

    conditionalQuestions.forEach((question) => {
      // Skip the no-conflict note here; we handle it separately
      if (question.id === "no-conflict-note") return;

      const condition = question.dataset.showIf;
      if (!condition) return;

      let show = false;
      const conditions = condition.split("&&");
      show = conditions.every((cond) => {
        const [name, value] = cond.split("=");
        const selected = form.querySelector(`input[name="${name}"]:checked`);
        return selected && selected.value === value;
      });

      question.style.display = show ? "block" : "none";
    });

    // Show "No Immediate Conflicts Identified" only if both Q2.1 and Q2.2 are "no"
    if (q2_1 === "no" && q2_2 === "no") {
      noConflictNote.style.display = "block";
    } else {
      noConflictNote.style.display = "none";
    }
  }

  // Add event listeners to all radio buttons in the form
  const radios = form.querySelectorAll('input[type="radio"]');
  radios.forEach((radio) => {
    radio.addEventListener("change", updateConditionalQuestions);
  });

  // Initial check on page load
  updateConditionalQuestions();
}
  
});
