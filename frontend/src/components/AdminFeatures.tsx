import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { sharedStyles } from '../utils/styles';

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
  const [comments, setComments] = useState<Comment[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState<number>(5);
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
      alert('Failed to add comment');
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
      alert('Failed to update comment');
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
      alert('Failed to delete comment');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRating = async () => {
    setLoading(true);
    try {
      await api.post('/ratings', {
        recipe_id: recipeId,
        rating: newRating,
      });
      await fetchData(); // Refresh to get updated rating
    } catch (error) {
      console.error('Error adding rating:', error);
      alert('Failed to add rating');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '40px', borderTop: '2px solid #e9ecef', paddingTop: '32px' }}>
      <style>{sharedStyles}</style>
      {/* Rating Section */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <h3 style={{ color: '#213547', fontSize: '1.5rem', fontWeight: '600', marginTop: 0, marginBottom: '16px' }}>
          ⭐ Rating
        </h3>
        {averageRating !== null && (
          <div style={{ marginBottom: '16px', fontSize: '1.25rem', color: '#213547' }}>
            Average Rating: <strong style={{ color: '#007bff' }}>{averageRating.toFixed(1)}</strong> / 5.0
            {ratings.length > 0 && (
              <span style={{ color: '#666', fontSize: '0.95rem', marginLeft: '8px' }}>
                ({ratings.length} {ratings.length === 1 ? 'rating' : 'ratings'})
              </span>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#213547', fontWeight: '500' }}>
            Your Rating:
            <select
              value={newRating}
              onChange={(e) => setNewRating(Number(e.target.value))}
              className="form-input"
              style={{ width: 'auto', padding: '8px 12px', fontSize: '1rem' }}
            >
              {[1, 2, 3, 4, 5].map(r => (
                <option key={r} value={r}>{r} ⭐</option>
              ))}
            </select>
          </label>
          <button
            onClick={handleAddRating}
            disabled={loading}
            className="action-button action-button-primary"
            style={{ 
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '⏳ Saving...' : 'Rate'}
          </button>
        </div>
      </div>

      {/* Comments Section */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <h3 style={{ color: '#213547', fontSize: '1.5rem', fontWeight: '600', marginTop: 0, marginBottom: '16px' }}>
          💬 Comments
        </h3>
        <div style={{ marginBottom: '20px' }}>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={4}
            className="form-input"
            style={{ 
              resize: 'vertical',
              fontFamily: 'inherit',
              minHeight: '100px'
            }}
          />
          <button
            onClick={handleAddComment}
            disabled={loading || !newComment.trim()}
            className="action-button action-button-primary"
            style={{ 
              marginTop: '12px',
              opacity: (loading || !newComment.trim()) ? 0.6 : 1,
              cursor: (loading || !newComment.trim()) ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '⏳ Adding...' : 'Add Comment'}
          </button>
        </div>
        <div>
          {comments.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
              No comments yet. Be the first to comment!
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                style={{
                  padding: '16px',
                  marginBottom: '12px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef',
                }}
              >
              {editingComment === comment.id ? (
                <div>
                  <textarea
                    value={editCommentText}
                    onChange={(e) => setEditCommentText(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px',
                    }}
                  />
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleUpdateComment(comment.id)}
                      disabled={loading || !editCommentText.trim()}
                      style={{
                        padding: '5px 12px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingComment(null);
                        setEditCommentText('');
                      }}
                      style={{
                        padding: '5px 12px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ color: '#213547', marginBottom: '8px' }}>{comment.content}</div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    {new Date(comment.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        setEditingComment(comment.id);
                        setEditCommentText(comment.content);
                      }}
                      className="action-button action-button-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.875rem' }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="action-button action-button-danger"
                      style={{ padding: '6px 12px', fontSize: '0.875rem' }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </>
              )}
              </div>
            ))
          )}
        </div>
      </div>
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

  useEffect(() => {
    fetchNotes();
  }, [recipeId]);

  const fetchNotes = async () => {
    try {
      setError(null);
      const notesRes = await api.get(`/notes/recipe/${recipeId}`);
      setNotes(notesRes.data);
    } catch (error: any) {
      // If 403, user is not the recipe creator - don't show notes
      if (error.response?.status === 403) {
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
      alert('Failed to add note');
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
      alert('Failed to update note');
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
      alert('Failed to delete note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: '40px' }}>
      <style>{sharedStyles}</style>
      <h2 style={{ color: '#213547', fontSize: '1.75rem', fontWeight: '600', marginTop: 0, marginBottom: '8px' }}>
        📝 Private Notes
      </h2>
      <p style={{ color: '#666', fontSize: '0.9rem', marginTop: 0, marginBottom: '24px' }}>
        Private notes visible only to you (recipe creator)
      </p>
      
      {error && !error.includes('only view notes') && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Notes Section */}
      <div>
        <div style={{ marginBottom: '20px' }}>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a private note (only visible to you)..."
            rows={4}
            className="form-input"
            style={{ 
              resize: 'vertical',
              fontFamily: 'inherit',
              minHeight: '100px'
            }}
          />
          <button
            onClick={handleAddNote}
            disabled={loading || !newNote.trim()}
            className="action-button action-button-secondary"
            style={{ 
              marginTop: '12px',
              opacity: (loading || !newNote.trim()) ? 0.6 : 1,
              cursor: (loading || !newNote.trim()) ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '⏳ Adding...' : 'Add Note'}
          </button>
        </div>
        <div>
          {notes.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
              No notes yet.
            </p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                style={{
                  padding: '16px',
                  marginBottom: '12px',
                  backgroundColor: '#fff3cd',
                  borderRadius: '8px',
                  border: '1px solid #ffc107',
                }}
              >
              {editingNote === note.id ? (
                <div>
                  <textarea
                    value={editNoteText}
                    onChange={(e) => setEditNoteText(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px',
                    }}
                  />
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleUpdateNote(note.id)}
                      disabled={loading || !editNoteText.trim()}
                      style={{
                        padding: '5px 12px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingNote(null);
                        setEditNoteText('');
                      }}
                      style={{
                        padding: '5px 12px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ color: '#213547', marginBottom: '8px' }}>{note.content}</div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    {new Date(note.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        setEditingNote(note.id);
                        setEditNoteText(note.content);
                      }}
                      className="action-button action-button-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.875rem' }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="action-button action-button-danger"
                      style={{ padding: '6px 12px', fontSize: '0.875rem' }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </>
              )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
