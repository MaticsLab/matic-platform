# Fillout Features - Usage Examples

This document provides practical examples of how to use the new Fillout-inspired features in Matic forms.

## Table of Contents
1. [Conditional Logic](#conditional-logic)
2. [Advanced Validation](#advanced-validation)
3. [Rich Text](#rich-text)
4. [Themes](#themes)
5. [Branching](#branching)
6. [Calculated Fields](#calculated-fields)

---

## Conditional Logic

### Example 1: Show Field Based on Selection
```json
{
  "field_key": "spouse_name",
  "field_type": "text",
  "label": "Spouse's Name",
  "required": false,
  "conditions": [
    {
      "type": "show",
      "conditions": [
        {
          "field_key": "marital_status",
          "operator": "equals",
          "value": "married"
        }
      ],
      "logic": "and"
    }
  ]
}
```

### Example 2: Require Field Based on Multiple Conditions
```json
{
  "field_key": "essay",
  "field_type": "textarea",
  "label": "Personal Essay",
  "required": false,
  "conditions": [
    {
      "type": "require",
      "conditions": [
        {
          "field_key": "applicant_type",
          "operator": "equals",
          "value": "first_time"
        },
        {
          "field_key": "age",
          "operator": "less_than",
          "value": 25
        }
      ],
      "logic": "and"
    }
  ]
}
```

### Example 3: Prefill Based on Previous Answer
```json
{
  "field_key": "billing_address",
  "field_type": "textarea",
  "label": "Billing Address",
  "conditions": [
    {
      "type": "prefill",
      "conditions": [
        {
          "field_key": "same_as_mailing",
          "operator": "equals",
          "value": true
        }
      ],
      "target": "billing_address",
      "value": "{mailing_address}"
    }
  ]
}
```

### Example 4: Complex OR Logic
```json
{
  "field_key": "financial_aid_form",
  "field_type": "file",
  "label": "Financial Aid Documentation",
  "conditions": [
    {
      "type": "show",
      "conditions": [
        {
          "field_key": "household_income",
          "operator": "less_than",
          "value": 50000
        },
        {
          "field_key": "financial_aid_requested",
          "operator": "equals",
          "value": true
        }
      ],
      "logic": "or"
    }
  ]
}
```

---

## Advanced Validation

### Example 1: Email with Domain Restrictions
```json
{
  "field_key": "work_email",
  "field_type": "email",
  "label": "Work Email",
  "required": true,
  "validation": {
    "validation_type": "email",
    "email_validation": {
      "require_corporate": true,
      "blocked_domains": ["competitor.com", "spam-site.com"],
      "allowed_domains": ["company.com", "partner.com"]
    },
    "pattern_message": "Please use your corporate email address"
  }
}
```

### Example 2: US Phone Number
```json
{
  "field_key": "phone",
  "field_type": "phone",
  "label": "Phone Number",
  "required": true,
  "validation": {
    "validation_type": "phone",
    "phone_validation": {
      "country_code": "US",
      "format": "(###) ###-####"
    },
    "pattern_message": "Format: (123) 456-7890"
  }
}
```

### Example 3: Date with Business Day Restrictions
```json
{
  "field_key": "interview_date",
  "field_type": "date",
  "label": "Preferred Interview Date",
  "required": true,
  "validation": {
    "validation_type": "date",
    "date_validation": {
      "min_date": "2026-02-10",
      "max_date": "2026-03-31",
      "allow_past": false,
      "disabled_days": [0, 6],
      "disabled_dates": ["2026-03-17", "2026-03-25"]
    },
    "pattern_message": "Please select a weekday between Feb 10 and Mar 31"
  }
}
```

### Example 4: URL with HTTPS Requirement
```json
{
  "field_key": "portfolio_url",
  "field_type": "url",
  "label": "Portfolio Website",
  "required": true,
  "validation": {
    "validation_type": "url",
    "url_validation": {
      "require_https": true,
      "blocked_domains": ["competitor.com"]
    },
    "pattern_message": "Please provide a secure HTTPS URL"
  }
}
```

### Example 5: Number Range with Length Constraint
```json
{
  "field_key": "gpa",
  "field_type": "number",
  "label": "GPA (0.0 - 4.0)",
  "required": true,
  "validation": {
    "min": 0.0,
    "max": 4.0,
    "pattern_message": "GPA must be between 0.0 and 4.0"
  }
}
```

### Example 6: Text with Character Limits
```json
{
  "field_key": "bio",
  "field_type": "textarea",
  "label": "Short Bio",
  "required": true,
  "validation": {
    "min_length": 50,
    "max_length": 500,
    "pattern_message": "Bio must be between 50 and 500 characters"
  }
}
```

### Example 7: Custom Regex Pattern
```json
{
  "field_key": "student_id",
  "field_type": "text",
  "label": "Student ID",
  "required": true,
  "validation": {
    "pattern": "^S[0-9]{7}$",
    "pattern_message": "Student ID must start with 'S' followed by 7 digits (e.g., S1234567)"
  }
}
```

---

## Rich Text

### Example 1: Field with HTML Label
```json
{
  "field_key": "terms_acceptance",
  "field_type": "checkbox",
  "label": "<strong>I agree to the Terms and Conditions</strong>",
  "description": "<p>By checking this box, you agree to our <a href='/terms' target='_blank'>Terms of Service</a> and <a href='/privacy' target='_blank'>Privacy Policy</a>.</p>",
  "help_text": "Please read the linked documents carefully before accepting",
  "is_rich_text": true,
  "required": true
}
```

### Example 2: Section Header with Formatting
```json
{
  "field_key": "section_header",
  "field_type": "heading",
  "label": "<h2>🎓 Educational Background</h2>",
  "description": "<p>Tell us about your academic history. Include all institutions attended, even if you didn't complete a degree.</p><ul><li>High school</li><li>College/University</li><li>Graduate school</li></ul>",
  "is_rich_text": true
}
```

### Example 3: Instructions with Emphasis
```json
{
  "field_key": "essay_prompt",
  "field_type": "paragraph",
  "label": "<h3>Essay Question</h3>",
  "description": "<p><strong>Required:</strong> Write a <em>500-700 word</em> essay describing:</p><ol><li>Your career goals</li><li>How this scholarship will help</li><li>Your commitment to community service</li></ol><p><span style='color: #ef4444;'>⚠️ Essays shorter than 500 words will not be considered.</span></p>",
  "is_rich_text": true
}
```

---

## Themes

### Example 1: Professional Blue Theme
```json
{
  "settings": {
    "theme": {
      "primary_color": "#2563eb",
      "secondary_color": "#64748b",
      "background_color": "#ffffff",
      "text_color": "#1e293b",
      "border_color": "#e2e8f0",
      "error_color": "#ef4444",
      "success_color": "#22c55e",
      "font_family": "Inter, -apple-system, sans-serif",
      "font_size": "16px",
      "heading_font": "Poppins, sans-serif",
      "border_radius": "8px",
      "spacing": "24px",
      "max_width": "800px",
      "button_style": "solid",
      "button_size": "md"
    }
  }
}
```

### Example 2: Modern Gradient Theme
```json
{
  "settings": {
    "theme": {
      "primary_color": "#8b5cf6",
      "secondary_color": "#ec4899",
      "background_color": "#faf5ff",
      "text_color": "#1f2937",
      "border_color": "#e9d5ff",
      "error_color": "#f43f5e",
      "success_color": "#10b981",
      "font_family": "'Plus Jakarta Sans', sans-serif",
      "font_size": "15px",
      "heading_font": "'Plus Jakarta Sans', sans-serif",
      "border_radius": "12px",
      "spacing": "20px",
      "max_width": "720px",
      "button_style": "solid",
      "button_size": "lg"
    }
  }
}
```

### Example 3: Minimal Outline Theme
```json
{
  "settings": {
    "theme": {
      "primary_color": "#000000",
      "secondary_color": "#6b7280",
      "background_color": "#ffffff",
      "text_color": "#111827",
      "border_color": "#d1d5db",
      "error_color": "#dc2626",
      "success_color": "#059669",
      "font_family": "'SF Pro Display', -apple-system, sans-serif",
      "font_size": "14px",
      "heading_font": "'SF Pro Display', sans-serif",
      "border_radius": "4px",
      "spacing": "16px",
      "max_width": "640px",
      "button_style": "outline",
      "button_size": "sm"
    }
  }
}
```

---

## Branching

### Example 1: Applicant Type Branching
```json
{
  "settings": {
    "enable_branching": true,
    "start_section_id": "intro",
    "branching_rules": [
      {
        "id": "student-path",
        "from_section_id": "intro",
        "to_section_id": "student_questions",
        "priority": 1,
        "conditions": [
          {
            "field_key": "applicant_type",
            "operator": "equals",
            "value": "student"
          }
        ]
      },
      {
        "id": "professional-path",
        "from_section_id": "intro",
        "to_section_id": "professional_questions",
        "priority": 2,
        "conditions": [
          {
            "field_key": "applicant_type",
            "operator": "equals",
            "value": "professional"
          }
        ]
      },
      {
        "id": "default-path",
        "from_section_id": "intro",
        "to_section_id": "general_questions",
        "priority": 99
        // No conditions = default fallback
      }
    ]
  }
}
```

### Example 2: Income-Based Branching
```json
{
  "settings": {
    "enable_branching": true,
    "branching_rules": [
      {
        "id": "low-income",
        "from_section_id": "financial_info",
        "to_section_id": "financial_aid_application",
        "priority": 1,
        "conditions": [
          {
            "field_key": "household_income",
            "operator": "less_than",
            "value": 40000
          }
        ]
      },
      {
        "id": "medium-income",
        "from_section_id": "financial_info",
        "to_section_id": "partial_scholarship",
        "priority": 2,
        "conditions": [
          {
            "field_key": "household_income",
            "operator": "less_than",
            "value": 80000
          }
        ]
      },
      {
        "id": "high-income",
        "from_section_id": "financial_info",
        "to_section_id": "standard_application",
        "priority": 3
      }
    ]
  }
}
```

---

## Calculated Fields

### Example 1: Total Cost
```json
{
  "field_key": "total_cost",
  "field_type": "calculated",
  "label": "Total Application Cost",
  "calculation_rule": "application_fee + processing_fee + late_fee",
  "validation": {
    "min": 0
  }
}
```

### Example 2: Age from Birth Date
```json
{
  "field_key": "age",
  "field_type": "calculated",
  "label": "Age",
  "calculation_rule": "YEAR(TODAY()) - YEAR(birth_date)",
  "help_text": "Calculated from your birth date"
}
```

### Example 3: Completion Percentage
```json
{
  "field_key": "completion",
  "field_type": "calculated",
  "label": "Application Completion",
  "calculation_rule": "(completed_sections / total_sections) * 100",
  "help_text": "Percentage of required sections completed"
}
```

---

## Complete Form Example

Here's a complete form that uses multiple features together:

```json
{
  "id": "scholarship-app",
  "name": "Annual Scholarship Application",
  "slug": "scholarship-2026",
  "settings": {
    "enable_rich_text": true,
    "show_progress_bar": true,
    "allow_save_and_exit": true,
    "autosave_interval": 30,
    "enable_branching": true,
    "show_confirmation_page": true,
    "confirmation_message": "Thank you! Your application has been submitted.",
    "theme": {
      "primary_color": "#2563eb",
      "background_color": "#ffffff",
      "font_family": "Inter, sans-serif",
      "border_radius": "8px",
      "button_style": "solid"
    },
    "branching_rules": [
      {
        "id": "needs-aid",
        "from_section_id": "basic_info",
        "to_section_id": "financial_aid",
        "priority": 1,
        "conditions": [
          {
            "field_key": "needs_financial_aid",
            "operator": "equals",
            "value": true
          }
        ]
      }
    ]
  },
  "sections": [
    {
      "id": "basic_info",
      "name": "Basic Information",
      "fields": [
        {
          "field_key": "first_name",
          "field_type": "text",
          "label": "First Name",
          "required": true,
          "validation": {
            "min_length": 2,
            "max_length": 50
          }
        },
        {
          "field_key": "email",
          "field_type": "email",
          "label": "Email Address",
          "required": true,
          "validation": {
            "validation_type": "email",
            "email_validation": {
              "require_corporate": false
            }
          }
        },
        {
          "field_key": "needs_financial_aid",
          "field_type": "checkbox",
          "label": "I need financial aid",
          "required": false
        },
        {
          "field_key": "household_income",
          "field_type": "number",
          "label": "Annual Household Income",
          "required": false,
          "conditions": [
            {
              "type": "show",
              "conditions": [
                {
                  "field_key": "needs_financial_aid",
                  "operator": "equals",
                  "value": true
                }
              ]
            }
          ],
          "validation": {
            "min": 0,
            "max": 999999
          }
        }
      ]
    },
    {
      "id": "financial_aid",
      "name": "Financial Aid Application",
      "conditions": [
        {
          "type": "show",
          "conditions": [
            {
              "field_key": "needs_financial_aid",
              "operator": "equals",
              "value": true
            }
          ]
        }
      ],
      "fields": [
        {
          "field_key": "aid_essay",
          "field_type": "textarea",
          "label": "<strong>Financial Need Statement</strong>",
          "description": "<p>Describe your financial circumstances and why this scholarship is important to you. <em>(Min 250 words)</em></p>",
          "is_rich_text": true,
          "required": true,
          "validation": {
            "min_length": 250,
            "max_length": 1000
          }
        }
      ]
    }
  ]
}
```

---

## API Usage

### Creating a Form with Features
```bash
curl -X POST http://localhost:8080/api/v1/forms \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @examples/complete-form.json
```

### Updating Field Validation
```bash
curl -X PATCH http://localhost:8080/api/v1/forms/{form_id}/fields/{field_id} \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "validation": {
      "validation_type": "email",
      "email_validation": {
        "require_corporate": true
      }
    }
  }'
```

### Updating Form Theme
```bash
curl -X PATCH http://localhost:8080/api/v1/forms/{form_id} \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "theme": {
        "primary_color": "#8b5cf6",
        "button_style": "solid"
      }
    }
  }'
```

---

## Testing Conditional Logic

To test conditional logic in the frontend:

1. **Show/Hide**: Change a field value and verify target field appears/disappears
2. **Require**: Check validation fails when condition met but field empty
3. **Prefill**: Verify value auto-populates when condition triggered
4. **Branching**: Complete a section and verify correct next section loads

---

## Validation Testing

Test validation patterns:

```javascript
// Email validation
const email = "user@gmail.com"
const validation = {
  validation_type: "email",
  email_validation: {
    require_corporate: true
  }
}
// Expected: Validation fails (free provider blocked)

// Phone validation
const phone = "123-456-7890"
const validation = {
  validation_type: "phone",
  phone_validation: {
    format: "(###) ###-####"
  }
}
// Expected: Validation fails (wrong format)

// Date validation
const date = "2026-12-25" // Christmas
const validation = {
  validation_type: "date",
  date_validation: {
    disabled_dates: ["2026-12-25"]
  }
}
// Expected: Validation fails (disabled date)
```

---

This document provides concrete examples for implementing and testing the new Fillout-inspired features.
