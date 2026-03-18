import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { useToast } from './ui/Toast';

interface Comment {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

interface Note {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

interface Rating {
  id: number;
  rating: number;
  created_at: string;
  updated_at: string;
}

interface AdminFeaturesProps {
  recipeId: number;
}

// Component for ratings and comments (available to everyone)
export function RecipeInteractions({ recipeId }: { recipeId: number }) {
  const { isGuest } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState<number>(5);
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isGuest) return;
    fetchData();
  }, [recipeId]);

  const fetchData = async () => {
    try {
      const [commentsRes, ratingsRes, avgRatingRes] = await Promise.all([
        api.get(`/comments/recipe/${recipeId}`),
        api.get(`/ratings/recipe/${recipeId}`),
        api.get(`/ratings/recipe/${recipeId}/average`),
      ]);
      setComments(commentsRes.data);
      setRatings(ratingsRes.data);
      setAverageRating(avgRatingRes.data.average);
    } catch (error) {
      console.error('Error fetching interactions:', error);
    }
  };

  const handleAddComment = async () => {
    if (isGuest) {
      navigate('/login');
      return;
    }
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      const response = await api.post('/comments', {
        recipe_id: recipeId,
        content: newComment,
      });
      setComments([...comments, response.data]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      push({ kind: 'error', title: 'Comment failed', message: 'Failed to add comment.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateComment = async (id: number) => {
    if (!editCommentText.trim()) return;
    setLoading(true);
    try {
      const response = await api.put(`/comments/${id}`, {
        content: editCommentText,
      });
      setComments(comments.map(c => c.id === id ? response.data : c));
      setEditingComment(null);
      setEditCommentText('');
    } catch (error) {
      console.error('Error updating comment:', error);
      push({ kind: 'error', title: 'Update failed', message: 'Failed to update comment.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (id: number) => {
    if (!confirm('Delete this comment?')) return;
    setLoading(true);
    try {
      await api.delete(`/comments/${id}`);
      setComments(comments.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting comment:', error);
      push({ kind: 'error', title: 'Delete failed', message: 'Failed to delete comment.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddRating = async () => {
    if (isGuest) {
      navigate('/login');
      return;
    }
    setLoading(true);
    try {
      await api.post('/ratings', {
        recipe_id: recipeId,
        rating: newRating,
      });
      await fetchData(); // Refresh to get updated rating
    } catch (error) {
      console.error('Error adding rating:', error);
      push({ kind: 'error', title: 'Rating failed', message: 'Failed to save rating.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-10 border-t border-border pt-8">
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="text-base font-semibold">Rating</div>
        {averageRating !== null && (
          <div className="mt-2 text-sm text-muted">
            Average: <span className="font-semibold text-text">{averageRating.toFixed(1)}</span> / 5.0
            {ratings.length > 0 && (
              <span className="ml-2">({ratings.length} {ratings.length === 1 ? 'rating' : 'ratings'})</span>
            )}
          </div>
        )}
        {isGuest ? (
          <div className="mt-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
            <div className="font-medium">Log in to rate</div>
            <div className="mt-2">
              <Button variant="primary" size="sm" onClick={() => navigate('/login')}>
                Log in
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm">
              <span className="font-medium">Your rating</span>
              <select
                value={newRating}
                onChange={(e) => setNewRating(Number(e.target.value))}
                className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
              >
                {[1, 2, 3, 4, 5].map(r => (
                  <option key={r} value={r}>{r} ⭐</option>
                ))}
              </select>
            </label>
            <Button variant="primary" onClick={handleAddRating} disabled={loading}>
              {loading ? 'Saving…' : 'Save rating'}
            </Button>
          </div>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="text-base font-semibold">Comments</div>
        {isGuest ? (
          <div className="mt-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
            <div className="font-medium">Log in to comment</div>
            <div className="mt-2">
              <Button variant="primary" size="sm" onClick={() => navigate('/login')}>
                Log in
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows={4}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
            <div className="mt-2">
              <Button variant="primary" onClick={handleAddComment} disabled={loading || !newComment.trim()}>
                {loading ? 'Adding…' : 'Add comment'}
              </Button>
            </div>
          </div>
        )}
        <div className="mt-4 space-y-2">
          {comments.length === 0 ? (
            <div className="text-sm text-muted">No comments yet.</div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="rounded-lg border border-border bg-surface px-4 py-3">
              {editingComment === comment.id ? (
                <div>
                  <textarea
                    value={editCommentText}
                    onChange={(e) => setEditCommentText(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleUpdateComment(comment.id)}
                      disabled={loading || !editCommentText.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingComment(null);
                        setEditCommentText('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-sm text-text">{comment.content}</div>
                  <div className="mt-1 text-xs text-muted">{new Date(comment.created_at).toLocaleDateString()}</div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingComment(comment.id);
                        setEditCommentText(comment.content);
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteComment(comment.id)}>
                      Delete
                    </Button>
                  </div>
                </>
              )}
              </div>
            ))
          )}
        </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Component for private notes (only visible to recipe creator)
export default function AdminFeatures({ recipeId }: AdminFeaturesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

  useEffect(() => {
    fetchNotes();
  }, [recipeId]);

  const fetchNotes = async () => {
    try {
      setError(null);
      const notesRes = await api.get(`/notes/recipe/${recipeId}`);
      setNotes(notesRes.data);
    } catch (error: unknown) {
      const anyErr = error as { response?: { status?: number } };
      // If 403, user is not the recipe creator - don't show notes
      if (anyErr.response?.status === 403) {
        setError('You can only view notes for recipes you created');
        setNotes([]);
      } else {
        console.error('Error fetching notes:', error);
        setError('Failed to load notes');
      }
    }
  };

  // Don't render if there's a permission error
  if (error && error.includes('only view notes')) {
    return null;
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setLoading(true);
    try {
      const response = await api.post('/notes', {
        recipe_id: recipeId,
        content: newNote,
      });
      setNotes([...notes, response.data]);
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
      push({ kind: 'error', title: 'Note failed', message: 'Failed to add note.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNote = async (id: number) => {
    if (!editNoteText.trim()) return;
    setLoading(true);
    try {
      const response = await api.put(`/notes/${id}`, {
        content: editNoteText,
      });
      setNotes(notes.map(n => n.id === id ? response.data : n));
      setEditingNote(null);
      setEditNoteText('');
    } catch (error) {
      console.error('Error updating note:', error);
      push({ kind: 'error', title: 'Update failed', message: 'Failed to update note.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async (id: number) => {
    if (!confirm('Delete this note?')) return;
    setLoading(true);
    try {
      await api.delete(`/notes/${id}`);
      setNotes(notes.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting note:', error);
      push({ kind: 'error', title: 'Delete failed', message: 'Failed to delete note.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-10">
      <CardContent className="p-5">
        <div className="text-base font-semibold">Private notes</div>
        <div className="mt-1 text-sm text-muted">Visible only to you (recipe creator).</div>
      
      {error && !error.includes('only view notes') && (
        <div className="mt-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          <div className="font-medium">Notes error</div>
          <div className="text-muted">{error}</div>
        </div>
      )}

      {/* Notes Section */}
      <div>
        <div className="mt-4">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a private note (only visible to you)..."
            rows={4}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
          <div className="mt-2">
            <Button variant="secondary" onClick={handleAddNote} disabled={loading || !newNote.trim()}>
              {loading ? 'Adding…' : 'Add note'}
            </Button>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {notes.length === 0 ? (
            <div className="text-sm text-muted">No notes yet.</div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-border bg-surface px-4 py-3">
              {editingNote === note.id ? (
                <div>
                  <textarea
                    value={editNoteText}
                    onChange={(e) => setEditNoteText(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleUpdateNote(note.id)}
                      disabled={loading || !editNoteText.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingNote(null);
                        setEditNoteText('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-sm text-text">{note.content}</div>
                  <div className="mt-1 text-xs text-muted">{new Date(note.created_at).toLocaleDateString()}</div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingNote(note.id);
                        setEditNoteText(note.content);
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteNote(note.id)}>
                      Delete
                    </Button>
                  </div>
                </>
              )}
              </div>
            ))
          )}
        </div>
      </div>
      </CardContent>
    </Card>
  );
}
