import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const [uploading, setUploading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start typing...',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose-editor',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Update editor content when the content prop changes (e.g., when loading existing recipe)
  useEffect(() => {
    if (editor && content !== undefined) {
      const currentContent = editor.getHTML();
      // Only update if the content is actually different to avoid unnecessary updates
      if (currentContent !== content) {
        editor.commands.setContent(content || '');
      }
    }
  }, [content, editor]);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/recipes/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const imageUrl = response.data.image_url;
      let fullUrl: string;
      if (imageUrl.startsWith('http')) {
        fullUrl = imageUrl;
      } else {
        // Static files are served at /uploads, not /api/uploads
        // So we need to use the base URL without /api
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
        const baseUrl = apiBaseUrl.replace('/api', '');
        fullUrl = `${baseUrl}${imageUrl}`;
      }
      
      if (editor) {
        editor.chain().focus().setImage({ src: fullUrl }).run();
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  };

  // Handle focus styling - attach to container and check editor focus state
  useEffect(() => {
    if (!editor || !containerRef.current) return;

    const handleFocusIn = (e: FocusEvent) => {
      // Check if focus is within the editor
      if (containerRef.current && containerRef.current.contains(e.target as Node)) {
        // Small delay to ensure editor view is updated
        setTimeout(() => {
          if (containerRef.current) {
            try {
              if (editor.view && editor.view.hasFocus()) {
                containerRef.current.style.borderColor = '#007bff';
                containerRef.current.style.boxShadow = '0 0 0 0.2rem rgba(0, 123, 255, 0.25)';
              }
            } catch {
              // Editor view not ready, use fallback
              containerRef.current.style.borderColor = '#007bff';
              containerRef.current.style.boxShadow = '0 0 0 0.2rem rgba(0, 123, 255, 0.25)';
            }
          }
        }, 0);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      // Check if focus moved outside the container
      if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
        if (containerRef.current) {
          containerRef.current.style.borderColor = '#ddd';
          containerRef.current.style.boxShadow = 'none';
        }
      }
    };

    const container = containerRef.current;
    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('focusout', handleFocusOut);

    return () => {
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('focusout', handleFocusOut);
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      style={{ 
        border: '1px solid #ddd',
        borderRadius: '4px',
        backgroundColor: '#fff',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <div 
        style={{ 
          marginBottom: '0',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          padding: '8px',
          borderBottom: '1px solid #eee',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px 4px 0 0',
        }}
        onClick={() => {
          // Focus editor when clicking toolbar
          if (editor) {
            editor.commands.focus();
          }
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            editor.chain().focus().toggleBold().run();
          }}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          style={{
            padding: '6px 12px',
            backgroundColor: editor.isActive('bold') ? '#007bff' : '#fff',
            color: editor.isActive('bold') ? '#fff' : '#213547',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!editor.isActive('bold')) {
              e.currentTarget.style.backgroundColor = '#e9ecef';
            }
          }}
          onMouseLeave={(e) => {
            if (!editor.isActive('bold')) {
              e.currentTarget.style.backgroundColor = '#fff';
            }
          }}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            editor.chain().focus().toggleItalic().run();
          }}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          style={{
            padding: '6px 12px',
            backgroundColor: editor.isActive('italic') ? '#007bff' : '#fff',
            color: editor.isActive('italic') ? '#fff' : '#213547',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontStyle: 'italic',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!editor.isActive('italic')) {
              e.currentTarget.style.backgroundColor = '#e9ecef';
            }
          }}
          onMouseLeave={(e) => {
            if (!editor.isActive('italic')) {
              e.currentTarget.style.backgroundColor = '#fff';
            }
          }}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            editor.chain().focus().toggleBulletList().run();
          }}
          style={{
            padding: '6px 12px',
            backgroundColor: editor.isActive('bulletList') ? '#007bff' : '#fff',
            color: editor.isActive('bulletList') ? '#fff' : '#213547',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!editor.isActive('bulletList')) {
              e.currentTarget.style.backgroundColor = '#e9ecef';
            }
          }}
          onMouseLeave={(e) => {
            if (!editor.isActive('bulletList')) {
              e.currentTarget.style.backgroundColor = '#fff';
            }
          }}
        >
          •
        </button>
        <label
          style={{
            padding: '6px 12px',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'inline-block',
            fontSize: '14px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e9ecef';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fff';
          }}
        >
          {uploading ? 'Uploading...' : '📷 Image'}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            style={{ display: 'none' }}
            disabled={uploading}
          />
        </label>
      </div>
      <div
        onClick={() => {
          // Focus editor when clicking the content area
          if (editor) {
            editor.commands.focus();
          }
        }}
        style={{
          cursor: 'text',
        }}
      >
        <EditorContent
          editor={editor}
          style={{
            minHeight: '150px',
            padding: '12px',
            outline: 'none',
            color: '#213547',
          }}
        />
      </div>
      <style>{`
        .ProseMirror {
          outline: none;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror p {
          margin: 0.5em 0;
          line-height: 1.6;
        }
        .ProseMirror p:first-child {
          margin-top: 0;
        }
        .ProseMirror p:last-child {
          margin-bottom: 0;
        }
        .ProseMirror ul, .ProseMirror ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .ProseMirror li {
          margin: 0.25em 0;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          margin: 0.5em 0;
          border-radius: 4px;
        }
        .ProseMirror strong {
          font-weight: 600;
        }
        .ProseMirror em {
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
