export const SUBJECT_OPTIONS = ["Bug", "Feedback", "Feature Request", "Other"];
export const MAX_MESSAGE_LENGTH = 1000;

// Since contact is only available for logged-in users,
// we only validate subject and message here.
export function validateContactForm(formData = {}) {
  const newErrors = {};
  const subject = (formData.subject || "").trim();
  const message = (formData.message || "").trim();

  if (!subject) {
    newErrors.subject = "Subject is required";
  } else if (!SUBJECT_OPTIONS.includes(subject)) {
    newErrors.subject = "Please select a valid subject";
  }

  if (!message) {
    newErrors.message = "Message is required";
  } else if (message.length < 10) {
    newErrors.message = "Message must be at least 10 characters";
  } else if (message.length > MAX_MESSAGE_LENGTH) {
    newErrors.message = `Message must be at most ${MAX_MESSAGE_LENGTH} characters`;
  }

  return newErrors;
}