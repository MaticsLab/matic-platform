/**
 * Matic Email Plugin
 * 
 * Provides email sending actions through Matic's connected Gmail account:
 * - Send emails to applicants
 * - Send emails to reviewers
 * - Send template-based emails
 */

import type { IntegrationPlugin } from "../registry";
import { registerIntegration } from "../registry";
import { MaticEmailIcon } from "./icon";

const maticEmailPlugin: IntegrationPlugin = {
  type: "matic-email",
  label: "Matic Email",
  description: "Send emails through your connected Gmail account",

  icon: MaticEmailIcon,

  // No manual configuration needed - uses current workspace context
  formFields: [],

  // Auto-connect capability - no credentials needed for internal integrations
  autoConnect: true,

  testConfig: {
    getTestFunction: async () => {
      const { testMaticEmail } = await import("./test");
      return testMaticEmail;
    },
  },

  actions: [
    {
      slug: "send-email",
      label: "Send Email",
      description: "Send an email to the applicant or specified recipients",
      category: "Matic Email",
      stepFunction: "sendEmailStep",
      stepImportPath: "send-email",
      outputFields: [
        { field: "messageId", description: "Message ID" },
        { field: "sentTo", description: "Recipients list" },
        { field: "sentAt", description: "Timestamp when sent" },
      ],
      configFields: [
        {
          key: "recipientType",
          label: "Send To",
          type: "select",
          options: [
            { value: "applicant", label: "Applicant" },
            { value: "custom", label: "Custom Email(s)" },
            { value: "reviewers", label: "Assigned Reviewers" },
          ],
          required: true,
        },
        {
          key: "customEmails",
          label: "Email Address(es)",
          type: "template-input",
          placeholder: "email@example.com, another@example.com",
          showWhen: { field: "recipientType", equals: "custom" },
        },
        {
          key: "applicationId",
          label: "Application ID",
          type: "template-input",
          placeholder: "{{Trigger.applicationId}}",
          example: "{{Trigger.applicationId}}",
          required: true,
        },
        {
          key: "subject",
          label: "Subject",
          type: "template-input",
          placeholder: "Application Update: {{GetApplication.applicantName}}",
          required: true,
        },
        {
          key: "body",
          label: "Email Body",
          type: "template-textarea",
          placeholder: "Dear {{GetApplication.applicantName}},\n\nYour application status has been updated...",
          rows: 6,
          required: true,
        },
        {
          key: "includeApplicationLink",
          label: "Include Application Link",
          type: "select",
          options: [
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ],
          defaultValue: "true",
        },
      ],
    },
    {
      slug: "send-notification",
      label: "Send Notification",
      description: "Send a quick notification email based on a preset type",
      category: "Matic Email",
      stepFunction: "sendNotificationStep",
      stepImportPath: "send-notification",
      outputFields: [
        { field: "messageId", description: "Message ID" },
        { field: "notificationType", description: "Type of notification sent" },
      ],
      configFields: [
        {
          key: "applicationId",
          label: "Application ID",
          type: "template-input",
          placeholder: "{{Trigger.applicationId}}",
          required: true,
        },
        {
          key: "notificationType",
          label: "Notification Type",
          type: "select",
          options: [
            { value: "submission_received", label: "Submission Received" },
            { value: "under_review", label: "Application Under Review" },
            { value: "approved", label: "Application Approved" },
            { value: "rejected", label: "Application Rejected" },
            { value: "waitlisted", label: "Added to Waitlist" },
            { value: "more_info_needed", label: "More Information Needed" },
            { value: "stage_changed", label: "Stage Changed" },
          ],
          required: true,
        },
        {
          key: "customMessage",
          label: "Custom Message (optional)",
          type: "template-textarea",
          placeholder: "Add any additional information...",
          rows: 3,
        },
      ],
    },
    {
      slug: "send-to-reviewers",
      label: "Email Reviewers",
      description: "Send an email to all assigned reviewers",
      category: "Matic Email",
      stepFunction: "sendToReviewersStep",
      stepImportPath: "send-to-reviewers",
      outputFields: [
        { field: "sentCount", description: "Number of emails sent" },
        { field: "reviewers", description: "List of reviewer emails" },
      ],
      configFields: [
        {
          key: "applicationId",
          label: "Application ID",
          type: "template-input",
          placeholder: "{{Trigger.applicationId}}",
          required: true,
        },
        {
          key: "subject",
          label: "Subject",
          type: "template-input",
          placeholder: "Review Request: {{GetApplication.applicantName}}",
          required: true,
        },
        {
          key: "body",
          label: "Email Body",
          type: "template-textarea",
          placeholder: "You have been assigned to review an application...",
          rows: 4,
          required: true,
        },
        {
          key: "includeReviewLink",
          label: "Include Review Link",
          type: "select",
          options: [
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ],
          defaultValue: "true",
        },
      ],
    },
  ],
};

// Auto-register on import
registerIntegration(maticEmailPlugin);

export default maticEmailPlugin;
