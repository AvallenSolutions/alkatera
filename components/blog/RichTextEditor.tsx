"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCallback, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageUpload } from '@/components/blog/ImageUpload';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

// Alkatera Color Palette
const ALKATERA_COLORS = [
  { name: 'Neon Lime', value: '#ccff00', hsl: 'hsl(84, 100%, 60%)' },
  { name: 'Neon Cyan', value: '#00d4ff', hsl: 'hsl(190, 100%, 50%)' },
  { name: 'Neon Purple', value: '#c000ff', hsl: 'hsl(280, 100%, 50%)' },
  { name: 'Neon Emerald', value: '#008a4d', hsl: 'hsl(160, 84%, 39%)' },
  { name: 'White', value: '#e6e6e6', hsl: 'hsl(0, 0%, 90%)' },
  { name: 'Gray', value: '#666666', hsl: 'hsl(0, 0%, 40%)' },
];

export function RichTextEditor({ content, onChange, placeholder = 'Write your content here...' }: RichTextEditorProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#ccff00] underline',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none min-h-[400px] p-4 focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const addLink = useCallback(() => {
    if (!linkUrl) return;

    editor?.chain().focus().setLink({ href: linkUrl }).run();
    setLinkUrl('');
    setLinkDialogOpen(false);
  }, [editor, linkUrl]);

  const addImage = useCallback(() => {
    if (!imageUrl) return;

    // Handle Dropbox URLs - convert to direct download links
    let processedUrl = imageUrl;
    if (imageUrl.includes('dropbox.com')) {
      processedUrl = imageUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '?raw=1');
      if (!processedUrl.includes('?raw=1')) {
        processedUrl = processedUrl.includes('?')
          ? processedUrl + '&raw=1'
          : processedUrl + '?raw=1';
      }
    }
    // Handle Google Drive URLs
    else if (imageUrl.includes('drive.google.com')) {
      const fileIdMatch = imageUrl.match(/[-\w]{25,}/);
      if (fileIdMatch) {
        processedUrl = `https://drive.google.com/uc?export=view&id=${fileIdMatch[0]}`;
      }
    }

    editor?.chain().focus().setImage({ src: processedUrl }).run();
    setImageUrl('');
    setImageDialogOpen(false);
  }, [editor, imageUrl]);

  const handleImageUpload = useCallback((url: string) => {
    if (!url) return;
    editor?.chain().focus().setImage({ src: url }).run();
    setImageDialogOpen(false);
  }, [editor]);

  if (!editor) {
    return null;
  }

  const MenuButton = ({ onClick, active, children, disabled }: any) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-8 w-8 p-0',
        active && 'bg-[#ccff00]/20 text-[#ccff00]'
      )}
    >
      {children}
    </Button>
  );

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden bg-[#0a0a0a]">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-white/10 bg-black/30">
        {/* Text Formatting */}
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
        >
          <Bold className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
        >
          <Italic className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
        >
          <UnderlineIcon className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
        >
          <Strikethrough className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
        >
          <Code className="h-4 w-4" />
        </MenuButton>

        {/* Text Color Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 w-8 p-0',
                editor.isActive('textStyle') && 'bg-[#ccff00]/20 text-[#ccff00]'
              )}
            >
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 bg-black/95 border-white/10">
            <div className="flex flex-col gap-2">
              <div className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">
                Alkatera Colors
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ALKATERA_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => editor.chain().focus().setColor(color.value).run()}
                    className={cn(
                      'w-10 h-10 rounded border-2 transition-all hover:scale-110',
                      editor.isActive('textStyle', { color: color.value })
                        ? 'border-white ring-2 ring-white/50'
                        : 'border-white/20 hover:border-white/50'
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
              <button
                onClick={() => editor.chain().focus().unsetColor().run()}
                className="mt-2 px-3 py-1.5 text-xs font-mono text-gray-400 border border-white/10 rounded hover:border-[#ccff00] hover:text-[#ccff00] transition-colors"
              >
                Reset Color
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Headings */}
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
        >
          <Heading1 className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
        >
          <Heading2 className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
        >
          <Heading3 className="h-4 w-4" />
        </MenuButton>

        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Lists */}
        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
        >
          <List className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
        >
          <ListOrdered className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
        >
          <Quote className="h-4 w-4" />
        </MenuButton>

        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Alignment */}
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
        >
          <AlignLeft className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
        >
          <AlignCenter className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
        >
          <AlignRight className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          active={editor.isActive({ textAlign: 'justify' })}
        >
          <AlignJustify className="h-4 w-4" />
        </MenuButton>

        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Media */}
        <MenuButton onClick={() => setLinkDialogOpen(true)}>
          <LinkIcon className="h-4 w-4" />
        </MenuButton>

        <MenuButton onClick={() => setImageDialogOpen(true)}>
          <ImageIcon className="h-4 w-4" />
        </MenuButton>

        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* History */}
        <MenuButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo className="h-4 w-4" />
        </MenuButton>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription>
              Enter the URL you want to link to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addLink()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addLink}>Insert Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
            <DialogDescription>
              Upload an image or provide a URL
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="url">URL</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="space-y-4 py-4">
              <ImageUpload
                onUploadComplete={handleImageUpload}
                label="Upload Image"
                description="Drag and drop or click to upload (max 10MB)"
              />
            </TabsContent>
            <TabsContent value="url" className="space-y-4 py-4">
              <div className="space-y-2">
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addImage()}
                />
                <p className="text-xs text-muted-foreground">
                  Supports direct image URLs, Dropbox, and Google Drive links
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImageDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={addImage} disabled={!imageUrl}>
                  Insert Image
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
