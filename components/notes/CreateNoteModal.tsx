'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Clock, Brain, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { fillTemplateVariables } from '@/db/seed/templates';

type NoteType = 'note' | 'journal';

interface Template {
  id: string;
  name: string;
  noteType: NoteType;
  content: string;
  isDefault: boolean;
}

interface CreateNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateNoteModal({ open, onOpenChange }: CreateNoteModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [noteType, setNoteType] = useState<NoteType | null>(null);
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Reset form when modal closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStep(1);
      setNoteType(null);
      setTitle('');
      setSourceUrl('');
      setSelectedTemplateId(null);
      setTemplates([]);
    }
    onOpenChange(open);
  };

  // Step 1: Select note type
  const handleTypeSelect = async (type: NoteType) => {
    setNoteType(type);
    setStep(2);
  };

  // Step 2: Enter basic info and move to templates
  const handleBasicInfoNext = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    
    // Fetch templates for selected note type
    setLoadingTemplates(true);
    try {
      const response = await fetch(`/api/templates?noteType=${noteType}`);
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      setTemplates(data.templates || []);
      setStep(3);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
      // Allow proceeding without templates
      setTemplates([]);
      setStep(3);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Step 3: Create note (with or without template)
  const handleCreateNote = async (skipTemplate = false) => {
    if (!noteType || !title.trim()) {
      toast.error('Missing required information');
      return;
    }

    setIsCreating(true);
    try {
      // Get template content and fill variables
      let content = '';
      if (!skipTemplate && selectedTemplateId) {
        const template = templates.find(t => t.id === selectedTemplateId);
        if (template) {
          // Fill template variables with current values
          content = fillTemplateVariables(template.content, {
            date: undefined, // Will use current date
            time: undefined, // Will use current time
            mood: noteType === 'journal' ? 5 : undefined,
            source: sourceUrl.trim() || undefined,
          });
        }
      }

      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content,
          noteType,
          sourceUrl: sourceUrl.trim() || undefined,
          templateId: skipTemplate ? undefined : selectedTemplateId,
          moodScore: noteType === 'journal' ? 5 : undefined, // Default neutral mood for journals
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create note');
      }

      const { note } = await response.json();
      toast.success('Note created successfully!');
      handleOpenChange(false);
      router.push(`/notes/${note.id}`);
    } catch (error) {
      console.error('Error creating note:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create note');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New {noteType === 'journal' ? 'Journal Entry' : noteType === 'note' ? 'Knowledge Note' : 'Note'}</DialogTitle>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-12 rounded-full transition-colors ${
                s === step ? 'bg-primary' : s < step ? 'bg-primary/60' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Type Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose the type of note you want to create:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Card
                className="p-6 cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleTypeSelect('journal')}
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/20">
                    <Clock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Journal Entry</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Time-based, emotional, ephemeral
                    </p>
                  </div>
                </div>
              </Card>

              <Card
                className="p-6 cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleTypeSelect('note')}
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/20">
                    <Brain className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Knowledge Note</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Timeless, interlinkable, permanent
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Step 2: Basic Info */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Enter note title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceUrl">Source URL (optional)</Label>
              <Input
                id="sourceUrl"
                type="url"
                placeholder="https://..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Add a source link if this note is based on external content
              </p>
            </div>

            <div className="flex gap-2 justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleBasicInfoNext} disabled={loadingTemplates}>
                {loadingTemplates ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    Loading...
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Template Selection */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Choose a template (optional)</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start with a template or skip to create a blank note
              </p>
            </div>

            {templates.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className={`p-4 cursor-pointer hover:border-primary transition-colors ${
                      selectedTemplateId === template.id ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{template.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {template.content.slice(0, 100)}...
                        </p>
                      </div>
                      {template.isDefault && (
                        <span className="text-xs bg-muted px-2 py-1 rounded">Default</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center text-muted-foreground">
                <p>No templates available for this note type</p>
              </Card>
            )}

            <div className="flex gap-2 justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleCreateNote(true)}
                  disabled={isCreating}
                >
                  Skip to Blank
                </Button>
                <Button
                  onClick={() => handleCreateNote(false)}
                  disabled={isCreating || (!selectedTemplateId && templates.length > 0)}
                >
                  {isCreating ? (
                    <>
                      <Spinner className="w-4 h-4 mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Note'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
