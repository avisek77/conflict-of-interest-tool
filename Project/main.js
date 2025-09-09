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
});
