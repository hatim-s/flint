"use client";

import { Info, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { NewTemplate, Template } from "@/db/schema/templates";

interface TemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template;
  onSave?: (template: Template) => void;
}

const TEMPLATE_VARIABLES = [
  { name: "{{date}}", description: "Current date (e.g., January 1, 2024)" },
  { name: "{{time}}", description: "Current time (e.g., 10:30 AM)" },
  { name: "{{mood}}", description: "Current mood score (1-10)" },
  { name: "{{source}}", description: "Source URL for the note" },
];

export function TemplateEditor({
  open,
  onOpenChange,
  template,
  onSave,
}: TemplateEditorProps) {
  const isEditing = !!template;

  const [name, setName] = useState(template?.name || "");
  const [noteType, setNoteType] = useState<"note" | "journal">(
    template?.noteType || "note",
  );
  const [content, setContent] = useState(template?.content || "");
  const [isDefault, setIsDefault] = useState(template?.isDefault || false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (!content.trim()) {
      toast.error("Please enter template content");
      return;
    }

    try {
      setIsSaving(true);

      const templateData: Partial<NewTemplate> = {
        name: name.trim(),
        noteType,
        content: content.trim(),
        isDefault,
      };

      let response: unknown;
      if (isEditing && template?.id) {
        // Update existing template
        response = await api.templates[":id"].$put({
          param: { id: template.id },
          json: templateData,
        });
      } else {
        // Create new template
        response = await api.templates.$post({
          json: templateData,
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save template");
      }

      const savedTemplateResponse = await response.json();
      const savedTemplate = isEditing
        ? savedTemplateResponse
        : savedTemplateResponse.template;
      toast.success(isEditing ? "Template updated" : "Template created");

      onSave?.(savedTemplate);
      onOpenChange(false);

      // Reset form
      setName("");
      setContent("");
      setNoteType("note");
      setIsDefault(false);
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save template",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Template" : "Create Custom Template"}
          </DialogTitle>
          <DialogDescription>
            Create a reusable template for your notes. Use template variables to
            auto-fill dynamic content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              placeholder="e.g., Weekly Review, Project Brief"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Note Type */}
          <div className="space-y-2">
            <Label>Note Type</Label>
            <RadioGroup
              value={noteType}
              onValueChange={(value) =>
                setNoteType(value as "note" | "journal")
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="note" id="note" />
                <Label htmlFor="note" className="font-normal cursor-pointer">
                  Knowledge Note - Timeless, interlinkable, permanent
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="journal" id="journal" />
                <Label htmlFor="journal" className="font-normal cursor-pointer">
                  Journal Entry - Time-based, emotional, ephemeral
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Template Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Template Content</Label>
            <Textarea
              id="content"
              placeholder="Write your template content here. Use markdown formatting and template variables like {{date}}, {{time}}, etc."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-75 font-mono text-sm"
            />
          </div>

          {/* Template Variables Help */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Available Template Variables:</p>
                <ul className="text-sm space-y-1 mt-2">
                  {TEMPLATE_VARIABLES.map((variable) => (
                    <li key={variable.name} className="flex gap-2">
                      <code className="bg-muted px-1 rounded">
                        {variable.name}
                      </code>
                      <span className="text-muted-foreground">
                        - {variable.description}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {/* Set as Default */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isDefault">Set as Default Template</Label>
              <p className="text-sm text-muted-foreground">
                Show this template first when creating new{" "}
                {noteType === "journal" ? "journal entries" : "notes"}
              </p>
            </div>
            <Switch
              id="isDefault"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isEditing ? (
              "Update Template"
            ) : (
              "Create Template"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
