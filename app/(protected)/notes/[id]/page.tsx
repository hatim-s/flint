"use client";

import {
  BookTemplate,
  CheckCircle2,
  FileText,
  Home,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { LiveTrackers, RelatedNotes, TipTapEditor } from "@/components/editor";
import { TemplateEditor } from "@/components/templates";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { VoiceCapture } from "@/components/voice";
import type { Note } from "@/db/schema/notes";

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function NoteEditorPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const noteId = resolvedParams.id;
  const router = useRouter();

  // State
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [moodScore, setMoodScore] = useState(5);
  const [wordCount, setWordCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);

  // Fetch note data
  useEffect(() => {
    const fetchNote = async () => {
      try {
        setIsLoading(true);
        const response = await api.notes[":id"].$get({
          param: { id: noteId },
        });

        if (!response.ok) {
          if (response.status === 404) {
            toast.error("Note not found");
            router.push("/dashboard");
            return;
          }
          throw new Error("Failed to fetch note");
        }

        const data = (await response.json()).data;
        setNote(data);
        setTitle(data.title);
        setContent(data.content);
        setMoodScore(data.moodScore ?? 5);
      } catch (error) {
        console.error("Error fetching note:", error);
        toast.error("Failed to load note");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNote();
  }, [noteId, router]);

  // Calculate word count when content changes
  useEffect(() => {
    const words = content.trim().split(/\s+/).filter(Boolean);
    setWordCount(words.length);
  }, [content]);

  // Save function
  const saveNote = useCallback(async () => {
    if (!note) return;

    try {
      setSaveStatus("saving");

      const response = await api.notes[":id"].$put({
        param: { id: noteId },
        json: {
          title,
          content,
          moodScore,
          updatedAt: note.updatedAt, // For optimistic locking
        },
      });

      if (!response.ok) {
        if (response.status === 409) {
          toast.error("Note was modified elsewhere. Please refresh.");
          setSaveStatus("error");
          return;
        }
        throw new Error("Failed to save note");
      }

      const { data: updatedNote } = await response.json();
      setNote(updatedNote);

      // Sync tags after saving note
      try {
        await api.notes[":id"].tags.$post({
          param: { id: noteId },
          json: { content },
        });
      } catch (tagError) {
        console.error("Error syncing tags:", tagError);
        // Don't fail the save if tag sync fails
      }

      // Sync people mentions after saving note
      try {
        await api.notes[":id"].mentions.$post({
          param: { id: noteId },
          json: { content },
        });
      } catch (mentionError) {
        console.error("Error syncing mentions:", mentionError);
        // Don't fail the save if mention sync fails
      }

      setSaveStatus("saved");
      toast.success("Note saved");
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to save note");
      setSaveStatus("error");
    }
  }, [noteId, title, content, moodScore, note]);

  // Auto-save logic with debouncing
  useEffect(() => {
    if (!note || isLoading) return;

    // Check if content has changed
    const hasChanged =
      title !== note.title ||
      content !== note.content ||
      moodScore !== (note.moodScore ?? 5);

    if (!hasChanged) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("unsaved");

    const timeoutId = setTimeout(() => {
      saveNote();
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(timeoutId);
  }, [title, content, moodScore, note, isLoading, saveNote]);

  // Handle voice transcription insertion
  const handleVoiceInsert = useCallback(
    (text: string) => {
      // Append transcription to content with a newline
      const separator = content.trim() ? "\n\n" : "";
      setContent(content + separator + text);
      setSaveStatus("unsaved");
    },
    [content],
  );

  // Delete function
  const handleDelete = async () => {
    try {
      setIsDeleting(true);

      const response = await api.notes[":id"].$delete({
        param: { id: noteId },
      });

      if (!response.ok) {
        throw new Error("Failed to delete note");
      }

      toast.success("Note deleted");
      router.push("/dashboard");
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Failed to delete note");
      setIsDeleting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!note) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard">
                    <Home className="h-4 w-4" />
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard">
                    <FileText className="h-4 w-4 mr-1" />
                    Notes
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{title || "Untitled"}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center gap-2">
              {/* Save Status Indicator */}
              <div className="flex items-center gap-2 text-sm">
                {saveStatus === "saved" && (
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Saved</span>
                  </div>
                )}
                {saveStatus === "saving" && (
                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </div>
                )}
                {saveStatus === "unsaved" && (
                  <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                    <Save className="h-4 w-4" />
                    <span>Unsaved changes</span>
                  </div>
                )}
                {saveStatus === "error" && (
                  <div className="text-red-600 dark:text-red-400">
                    <span>Error saving</span>
                  </div>
                )}
              </div>

              <Separator orientation="vertical" className="h-6" />

              {/* Voice Capture Button */}
              <VoiceCapture onInsert={handleVoiceInsert} position="inline" />

              {/* Save as Template Button */}
              <Button
                onClick={() => setIsTemplateEditorOpen(true)}
                size="sm"
                variant="ghost"
              >
                <BookTemplate className="h-4 w-4 mr-2" />
                Save as Template
              </Button>

              {/* Manual Save Button */}
              <Button
                onClick={saveNote}
                disabled={saveStatus === "saving" || saveStatus === "saved"}
                size="sm"
                variant="outline"
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>

              {/* Delete Button */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Note</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this note? This action
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        "Delete"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Title Input */}
          <div className="flex items-center gap-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              className="text-2xl font-bold border-0 px-0 focus-visible:ring-0"
            />
            <Badge
              variant={note.noteType === "journal" ? "default" : "secondary"}
            >
              {note.noteType === "journal" ? "Journal" : "Note"}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="container mx-auto px-4 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 h-full py-6">
            {/* Editor Area (70%) */}
            <div className="flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <TipTapEditor
                  content={content}
                  onChange={setContent}
                  placeholder="Start writing your note..."
                  editable={true}
                  className="h-full"
                />
              </div>
            </div>

            {/* Sidebar (30%) */}
            <div className="overflow-y-auto space-y-4">
              <LiveTrackers
                moodScore={moodScore}
                onMoodChange={setMoodScore}
                wordCount={wordCount}
                noteType={note.noteType}
              />

              {/* Serendipity Engine - Related Notes */}
              <RelatedNotes
                noteId={noteId}
                content={content}
                debounceMs={30000}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Template Editor Dialog */}
      {note && (
        <TemplateEditor
          open={isTemplateEditorOpen}
          onOpenChange={setIsTemplateEditorOpen}
          template={{
            id: "",
            userId: "",
            name: title || "Untitled Template",
            noteType: note.noteType,
            content: content,
            isDefault: false,
            createdAt: new Date(),
          }}
          onSave={() => {
            toast.success("Template saved successfully");
          }}
        />
      )}
    </div>
  );
}
