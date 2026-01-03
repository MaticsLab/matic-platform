'use client';

import { useState } from 'react';
import { Button } from '@/ui-components/button';
import { Textarea } from '@/ui-components/textarea';
import { Card } from '@/ui-components/card';

export default function TestAIPage() {
  const [input, setInput] = useState('hey can u send me that file **important**');
  const [option, setOption] = useState<'improve' | 'fix' | 'shorter' | 'longer'>('improve');
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'google' | 'cohere' | ''>('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const testAI = async () => {
    setIsLoading(true);
    setResult('');
    setDebugInfo(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: input,
          option,
          provider: provider || undefined,
          debug: true, // Enable debug mode
        }),
      });

      // Capture debug headers
      const headers = {
        provider: response.headers.get('X-AI-Provider'),
        model: response.headers.get('X-AI-Model'),
        debug: response.headers.get('X-Debug'),
      };

      const text = await response.text();
      
      setResult(text);
      setDebugInfo({
        status: response.status,
        headers,
        inputLength: input.length,
        outputLength: text.length,
      });
      
      // If status is not 2xx, treat response as error
      if (!response.ok) {
        console.error('API Error Response:', text);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setResult(`Error: ${errorMsg}`);
      console.error('Test AI Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI Model Test Interface</h1>
          <p className="text-gray-600">Test AI text improvements with different models and see debug info</p>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Input Text (simulates editor content)</label>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter text to test..."
                className="min-h-[120px] font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Try with markdown: **bold**, _italic_, [link](url)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Task</label>
                <select
                  value={option}
                  onChange={(e) => setOption(e.target.value as any)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="improve">Improve writing</option>
                  <option value="fix">Fix grammar</option>
                  <option value="shorter">Make shorter</option>
                  <option value="longer">Make longer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Provider (optional)</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as any)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Auto (recommended)</option>
                  <option value="openai">OpenAI (GPT-4o)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="google">Google (Gemini)</option>
                  <option value="cohere">Cohere</option>
                </select>
              </div>
            </div>

            <Button 
              onClick={testAI} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Testing...' : 'Test AI'}
            </Button>
          </div>
        </Card>

        {debugInfo && (
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h3 className="font-semibold mb-3 text-blue-900">Debug Information</h3>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-medium">Status:</span>
                  <span className={`ml-2 ${debugInfo.status === 200 ? 'text-green-600' : 'text-red-600'}`}>
                    {debugInfo.status}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Provider:</span>
                  <span className="ml-2 font-mono">{debugInfo.headers.provider}</span>
                </div>
                <div>
                  <span className="font-medium">Model:</span>
                  <span className="ml-2 font-mono">{debugInfo.headers.model}</span>
                </div>
                <div>
                  <span className="font-medium">Input Length:</span>
                  <span className="ml-2">{debugInfo.inputLength} chars</span>
                </div>
                <div>
                  <span className="font-medium">Output Length:</span>
                  <span className="ml-2">{debugInfo.outputLength} chars</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-3">
              Check your terminal/server logs for detailed debug output
            </p>
          </Card>
        )}

        {result && (
          <Card className="p-6">
            <h3 className="font-semibold mb-3">
              {debugInfo?.status && debugInfo.status >= 400 ? 'Error Response' : 'AI Output'}
            </h3>
            <div className={`border rounded-lg p-4 ${
              debugInfo?.status && debugInfo.status >= 400 
                ? 'bg-red-50 border-red-200' 
                : 'bg-white'
            }`}>
              <p className={`whitespace-pre-wrap ${
                debugInfo?.status && debugInfo.status >= 400 
                  ? 'text-red-900 font-mono text-sm' 
                  : 'text-gray-900'
              }`}>{result}</p>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Quality Checks:</h4>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className={result.toLowerCase().includes("here's") || result.toLowerCase().includes("here is") ? '❌' : '✅'}>
                    {result.toLowerCase().includes("here's") || result.toLowerCase().includes("here is") ? '❌' : '✅'}
                  </span>
                  <span>No "Here's" or "Here is" prefix</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={result.startsWith('"') || result.startsWith("'") ? '❌' : '✅'}>
                    {result.startsWith('"') || result.startsWith("'") ? '❌' : '✅'}
                  </span>
                  <span>No quotes around output</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={result.toLowerCase().includes('improved version') || result.toLowerCase().includes('corrected') ? '❌' : '✅'}>
                    {result.toLowerCase().includes('improved version') || result.toLowerCase().includes('corrected') ? '❌' : '✅'}
                  </span>
                  <span>No explanatory text</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={result.includes('**') || result.includes('_') || result.includes('[') ? '❌' : '✅'}>
                    {result.includes('**') || result.includes('_') || result.includes('[') ? '❌' : '✅'}
                  </span>
                  <span>No markdown artifacts</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6 bg-gray-100">
          <h3 className="font-semibold mb-3">Test Cases</h3>
          <div className="space-y-2">
            {[
              { text: 'hey can u send me that file', desc: 'Casual text' },
              { text: '**this is important** and needs work', desc: 'With markdown bold' },
              { text: '_italic text_ that should be **improved**', desc: 'Mixed markdown' },
              { text: 'their going too the store', desc: 'Grammar errors' },
              { text: '[click here](https://example.com) for more', desc: 'With link' },
            ].map((testCase, i) => (
              <button
                key={i}
                onClick={() => setInput(testCase.text)}
                className="w-full text-left px-3 py-2 bg-white border rounded hover:bg-gray-50 text-sm"
              >
                <span className="font-medium">{testCase.desc}:</span>
                <span className="ml-2 text-gray-600 font-mono">{testCase.text}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

