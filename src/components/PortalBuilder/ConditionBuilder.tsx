import React from 'react'
import { Button } from '@/ui-components/button'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Condition } from '@/lib/condition-evaluator'

interface ConditionBuilderProps {
  conditions: Condition[]
  onConditionsChange: (conditions: Condition[]) => void
  availableFields: Array<{ id: string; label: string; type: string }>
}

const OPERATOR_BY_TYPE: Record<string, string[]> = {
  text: ['equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'],
  email: ['equals', 'notEquals', 'contains', 'notContains', 'isEmpty', 'isNotEmpty'],
  number: ['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'],
  date: ['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'],
  select: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  multiselect: ['contains', 'notContains', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  checkbox: ['equals', 'isEmpty', 'isNotEmpty'],
  default: ['equals', 'notEquals', 'contains', 'isEmpty', 'isNotEmpty']
}

const OPERATOR_LABELS: Record<string, string> = {
  equals: 'Equals',
  notEquals: 'Not Equals',
  contains: 'Contains',
  notContains: 'Does Not Contain',
  in: 'Is Any Of',
  notIn: 'Is Not Any Of',
  gt: 'Greater Than',
  gte: 'Greater Than or Equal',
  lt: 'Less Than',
  lte: 'Less Than or Equal',
  isEmpty: 'Is Empty',
  isNotEmpty: 'Is Not Empty',
  startsWith: 'Starts With',
  endsWith: 'Ends With'
}

export function ConditionBuilder({ conditions, onConditionsChange, availableFields }: ConditionBuilderProps) {
  const getOperatorsForField = (fieldId: string): string[] => {
    const field = availableFields.find(f => f.id === fieldId)
    if (!field) return OPERATOR_BY_TYPE.default
    return OPERATOR_BY_TYPE[field.type] || OPERATOR_BY_TYPE.default
  }

  const handleAddCondition = () => {
    const newCondition: Condition = {
      fieldId: availableFields[0]?.id || '',
      operator: 'equals',
      value: ''
    }
    onConditionsChange([...conditions, newCondition])
  }

  const handleUpdateCondition = (index: number, updates: Partial<Condition>) => {
    const updated = [...conditions]
    updated[index] = { ...updated[index], ...updates }
    onConditionsChange(updated)
  }

  const handleRemoveCondition = (index: number) => {
    onConditionsChange(conditions.filter((_, i) => i !== index))
  }

  const noValueOperators = ['isEmpty', 'isNotEmpty']

  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Conditions (Optional)</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddCondition}
          className="gap-1"
        >
          <Plus className="w-3 h-3" />
          Add Condition
        </Button>
      </div>

      {conditions.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No conditions - ending will always show</p>
      ) : (
        <div className="space-y-2">
          {conditions.map((condition, index) => (
            <div key={index} className="flex gap-2 items-start bg-white p-2 rounded border border-gray-200">
              <div className="flex-1 grid grid-cols-3 gap-2">
                {/* Field Select */}
                <select
                  value={condition.fieldId}
                  onChange={(e) => handleUpdateCondition(index, { fieldId: e.target.value })}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select field</option>
                  {availableFields.map(field => (
                    <option key={field.id} value={field.id}>
                      {field.label}
                    </option>
                  ))}
                </select>

                {/* Operator Select */}
                <select
                  value={condition.operator}
                  onChange={(e) => handleUpdateCondition(index, { operator: e.target.value as Condition['operator'] })}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {getOperatorsForField(condition.fieldId).map(op => (
                    <option key={op} value={op}>
                      {OPERATOR_LABELS[op]}
                    </option>
                  ))}
                </select>

                {/* Value Input */}
                {!noValueOperators.includes(condition.operator) && (
                  <input
                    type="text"
                    value={condition.value || ''}
                    onChange={(e) => handleUpdateCondition(index, { value: e.target.value })}
                    placeholder="Value"
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Delete Button */}
              <button
                onClick={() => handleRemoveCondition(index)}
                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                title="Delete condition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        {conditions.length > 0 ? 'All conditions must be met to show this ending' : 'Add conditions to control when this ending appears'}
      </p>
    </div>
  )
}
