"use client";

import { useSession, signOut } from "@/auth/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Plus } from "lucide-react";
import { CreateNoteModal } from "@/components/notes";
import { useState, useEffect } from "react";

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Global keyboard shortcut: Cmd+N / Ctrl+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setIsCreateModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b bg-white dark:bg-zinc-950">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <h1 className="text-xl font-semibold">Flint</h1>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image || undefined} alt={user.name} />
                    <AvatarFallback>
                      {user.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{user.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/login"; } } })}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                Welcome back{user?.name ? `, ${user.name}` : ""}!
              </h2>
              <p className="mt-2 text-muted-foreground">
                Your AI-native note-taking second brain
              </p>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Note
            </Button>
          </div>

          {/* Dashboard content will go here */}
          <div className="mt-8">
            <p className="text-sm text-muted-foreground">
              Press <kbd className="px-2 py-1 text-xs bg-muted rounded">Cmd+N</kbd> or{" "}
              <kbd className="px-2 py-1 text-xs bg-muted rounded">Ctrl+N</kbd> to create a new note
            </p>
          </div>
        </div>
      </main>

      <CreateNoteModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} />
    </div>
  );
}
