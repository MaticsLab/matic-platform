/**
 * Matic Review Plugin
 * 
 * Provides actions for managing application reviews in the Matic platform:
 * - Move applications to stages
 * - Assign reviewers
 * - Add/remove tags
 * - Update application status
 */

import type { IntegrationPlugin } from "../registry";
import { registerIntegration } from "../registry";
import { MaticReviewIcon } from "./icon";

const maticReviewPlugin: IntegrationPlugin = {
  type: "matic-review",
  label: "Application Review",
  description: "Manage application reviews, stages, and assignments",

  icon: MaticReviewIcon,

  formFields: [
    {
      id: "apiUrl",
      label: "Matic API URL",
      type: "url",
      placeholder: "https://backend.maticslab.com",
      configKey: "apiUrl",
      envVar: "MATIC_API_URL",
      helpText: "The URL of your Matic backend API",
    },
    {
      id: "workspaceId",
      label: "Workspace ID",
      type: "text",
      placeholder: "workspace-uuid",
      configKey: "workspaceId",
      envVar: "MATIC_WORKSPACE_ID",
      helpText: "Your Matic workspace ID",
    },
    {
      id: "formId",
      label: "Form/Application ID",
      type: "text",
      placeholder: "form-uuid",
      configKey: "formId",
      envVar: "MATIC_FORM_ID",
      helpText: "The form/application this workflow is for",
    },
  ],

  testConfig: {
    getTestFunction: async () => {
      const { testMaticReview } = await import("./test");
      return testMaticReview;
    },
  },

  // ACTIONS - Things the workflow can do
  actions: [
    {
      slug: "move-to-stage",
      label: "Move to Stage",
      description: "Move an application to a specific review stage",
      category: "Application Review",
      stepFunction: "moveToStageStep",
      stepImportPath: "move-to-stage",
      outputFields: [
        { field: "success", description: "Whether the move was successful" },
        { field: "applicationId", description: "The application ID" },
        { field: "stageId", description: "The new stage ID" },
      ],
      configFields: [
        {
          key: "applicationId",
          label: "Application ID",
          type: "template-input",
          placeholder: "{{Trigger.applicationId}}",
          example: "{{Trigger.applicationId}}",
          required: true,
        },
        {
          key: "stageId",
          label: "Target Stage",
          type: "select",
          placeholder: "Select stage",
          options: [], // Populated dynamically from API
          required: true,
        },
        {
          key: "reason",
          label: "Reason (optional)",
          type: "template-textarea",
          placeholder: "Reason for moving to this stage",
          rows: 2,
        },
      ],
    },
    {
      slug: "assign-reviewers",
      label: "Assign Reviewers",
      description: "Assign reviewers to an application",
      category: "Application Review",
      stepFunction: "assignReviewersStep",
      stepImportPath: "assign-reviewers",
      outputFields: [
        { field: "success", description: "Whether the assignment was successful" },
        { field: "assignedCount", description: "Number of reviewers assigned" },
      ],
      configFields: [
        {
          key: "applicationId",
          label: "Application ID",
          type: "template-input",
          placeholder: "{{Trigger.applicationId}}",
          example: "{{Trigger.applicationId}}",
          required: true,
        },
        {
          key: "reviewerTypeId",
          label: "Reviewer Type",
          type: "select",
          placeholder: "Select reviewer type",
          options: [], // Populated dynamically
        },
        {
          key: "reviewerIds",
          label: "Specific Reviewers (comma-separated)",
          type: "template-input",
          placeholder: "reviewer-id-1, reviewer-id-2",
        },
        {
          key: "autoAssign",
          label: "Auto-assign based on workload",
          type: "select",
          options: [
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ],
          defaultValue: "false",
        },
      ],
    },
    {
      slug: "add-tags",
      label: "Add Tags",
      description: "Add tags to an application",
      category: "Application Review",
      stepFunction: "addTagsStep",
      stepImportPath: "add-tags",
      outputFields: [
        { field: "success", description: "Whether tags were added" },
        { field: "tags", description: "List of tags now on the application" },
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
          key: "tags",
          label: "Tags (comma-separated)",
          type: "template-input",
          placeholder: "priority, needs-review, scholarship-eligible",
          example: "priority, scholarship-eligible",
          required: true,
        },
      ],
    },
    {
      slug: "remove-tags",
      label: "Remove Tags",
      description: "Remove tags from an application",
      category: "Application Review",
      stepFunction: "removeTagsStep",
      stepImportPath: "remove-tags",
      outputFields: [
        { field: "success", description: "Whether tags were removed" },
        { field: "tags", description: "List of remaining tags" },
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
          key: "tags",
          label: "Tags to Remove (comma-separated)",
          type: "template-input",
          placeholder: "pending, needs-review",
          required: true,
        },
      ],
    },
    {
      slug: "set-status",
      label: "Set Status",
      description: "Set the status of an application",
      category: "Application Review",
      stepFunction: "setStatusStep",
      stepImportPath: "set-status",
      outputFields: [
        { field: "success", description: "Whether status was updated" },
        { field: "status", description: "New status" },
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
          key: "status",
          label: "Status",
          type: "select",
          placeholder: "Select status",
          options: [
            { value: "pending", label: "Pending" },
            { value: "in_review", label: "In Review" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "waitlisted", label: "Waitlisted" },
          ],
          required: true,
        },
        {
          key: "comment",
          label: "Comment (optional)",
          type: "template-textarea",
          placeholder: "Add a comment about this status change",
          rows: 2,
        },
      ],
    },
    {
      slug: "get-application",
      label: "Get Application Data",
      description: "Fetch application data including submission fields",
      category: "Application Review",
      stepFunction: "getApplicationStep",
      stepImportPath: "get-application",
      outputFields: [
        { field: "id", description: "Application ID" },
        { field: "data", description: "Submission data fields" },
        { field: "status", description: "Current status" },
        { field: "stageId", description: "Current stage ID" },
        { field: "stageName", description: "Current stage name" },
        { field: "submittedAt", description: "Submission timestamp" },
        { field: "applicantEmail", description: "Applicant email" },
        { field: "applicantName", description: "Applicant name" },
        { field: "scores", description: "Review scores" },
        { field: "averageScore", description: "Average score" },
        { field: "tags", description: "Current tags" },
      ],
      configFields: [
        {
          key: "applicationId",
          label: "Application ID",
          type: "template-input",
          placeholder: "{{Trigger.applicationId}}",
          required: true,
        },
      ],
    },
    {
      slug: "check-score",
      label: "Check Score",
      description: "Evaluate application scores against criteria",
      category: "Application Review",
      stepFunction: "checkScoreStep",
      stepImportPath: "check-score",
      outputFields: [
        { field: "passes", description: "Whether the check passes" },
        { field: "averageScore", description: "Current average score" },
        { field: "reviewCount", description: "Number of reviews" },
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
          key: "operator",
          label: "Comparison",
          type: "select",
          options: [
            { value: ">=", label: "Greater than or equal" },
            { value: ">", label: "Greater than" },
            { value: "<=", label: "Less than or equal" },
            { value: "<", label: "Less than" },
            { value: "==", label: "Equal to" },
          ],
          required: true,
        },
        {
          key: "threshold",
          label: "Score Threshold",
          type: "number",
          placeholder: "80",
          min: 0,
          required: true,
        },
        {
          key: "minReviews",
          label: "Minimum Reviews Required",
          type: "number",
          placeholder: "2",
          min: 0,
          defaultValue: "1",
        },
      ],
    },
  ],
};

// Auto-register on import
registerIntegration(maticReviewPlugin);

export default maticReviewPlugin;
