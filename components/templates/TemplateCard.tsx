'use client';

import { cn } from '@/components/ui/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, BookOpen, Calendar, Lightbulb, Users, GraduationCap, Search, FolderKanban, Clock } from 'lucide-react';
import type { Template } from '@/db/schema/templates';

interface TemplateCardProps {
  template: Template;
  selected?: boolean;
  onClick?: () => void;
  showPreview?: boolean;
}

// Icon mapping based on template name
const getTemplateIcon = (name: string) => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('daily') || nameLower.includes('morning') || nameLower.includes('evening')) {
    return Clock;
  }
  if (nameLower.includes('weekly')) {
    return Calendar;
  }
  if (nameLower.includes('literature') || nameLower.includes('research')) {
    return BookOpen;
  }
  if (nameLower.includes('meeting')) {
    return Users;
  }
  if (nameLower.includes('idea')) {
    return Lightbulb;
  }
  if (nameLower.includes('learning')) {
    return GraduationCap;
  }
  if (nameLower.includes('project')) {
    return FolderKanban;
  }
  return FileText;
};

export function TemplateCard({ template, selected, onClick, showPreview = true }: TemplateCardProps) {
  const Icon = getTemplateIcon(template.name);
  const preview = showPreview ? template.content.slice(0, 150).trim() + (template.content.length > 150 ? '...' : '') : null;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        selected && 'ring-2 ring-primary bg-primary/5'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              'p-2 rounded-lg',
              template.noteType === 'journal' 
                ? 'bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400'
                : 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{template.name}</CardTitle>
            </div>
          </div>
          {template.isDefault && (
            <Badge variant="secondary" className="text-xs">
              Default
            </Badge>
          )}
        </div>
      </CardHeader>
      {showPreview && preview && (
        <CardContent>
          <CardDescription className="text-sm line-clamp-3 font-mono">
            {preview}
          </CardDescription>
        </CardContent>
      )}
    </Card>
  );
}
