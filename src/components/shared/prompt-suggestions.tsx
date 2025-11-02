'use client';

import { useState } from 'react';
import { suggestSimilarPrompts, SuggestSimilarPromptsOutput } from '@/ai/flows/suggest-similar-prompts';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PromptSuggestionsProps {
  originalPrompt: string;
  onSelectSuggestion: (suggestion: string) => void;
}

export function PromptSuggestions({ originalPrompt, onSelectSuggestion }: PromptSuggestionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { toast } = useToast();

  const handleFetchSuggestions = async () => {
    if (suggestions.length > 0) {
      setPopoverOpen(true);
      return;
    }

    setIsLoading(true);
    setPopoverOpen(true);
    try {
      const result: SuggestSimilarPromptsOutput = await suggestSimilarPrompts({ prompt: originalPrompt });
      setSuggestions(result.suggestions);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not fetch prompt suggestions. Please try again.",
      });
      setPopoverOpen(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSelect = (suggestion: string) => {
    onSelectSuggestion(suggestion);
    setPopoverOpen(false);
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" onClick={handleFetchSuggestions}>
          <Sparkles className="mr-2 h-4 w-4" />
          Suggest
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Similar Prompts</h4>
            <p className="text-sm text-muted-foreground">
              Based on: "{originalPrompt}"
            </p>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-2">
              {suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto whitespace-normal text-left justify-start"
                  onClick={() => handleSelect(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
