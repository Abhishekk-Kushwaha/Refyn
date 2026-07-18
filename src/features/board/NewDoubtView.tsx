import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Input, Textarea } from '@/components/ui';
import { useToast } from '@/components/feedback';
import { postDoubt } from '@/services/doubts.service';
import { useAuthStore } from '@/stores/authStore';
import { useExamStore } from '@/stores/examStore';
import { getErrorMessage } from '@/lib/errors';
import { MOCK_QUESTIONS } from '@/lib/mockQuestions';
import clsx from 'clsx';

export const NewDoubtView = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const user = useAuthStore((s) => s.session?.user);
  const examId = useExamStore((s) => s.selectedExamId) ?? 'cat';

  const concepts = useMemo(() => {
    const seen = new Map<string, string>();
    MOCK_QUESTIONS.forEach((q) => seen.set(q.subtopicId, q.subtopicName));
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, []);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [conceptId, setConceptId] = useState<string | undefined>(undefined);
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!user) return;
    setPosting(true);
    try {
      const doubt = await postDoubt({
        examId,
        authorId: user.id,
        authorName: user.displayName ?? 'Anonymous',
        title,
        body,
        conceptId,
        conceptName: concepts.find((c) => c.id === conceptId)?.name,
      });
      toast.success('Doubt posted!');
      navigate(`/board/${doubt.id}`, { replace: true });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => navigate('/board')}
          className="text-text-muted hover:text-text-primary text-sm mb-4 transition-colors"
        >
          ← Back to board
        </button>

        <h1 className="text-2xl font-semibold text-text-primary mb-1">Ask a Doubt</h1>
        <p className="text-text-muted text-sm mb-6">
          Tag the concept — answerers with proven accuracy in it get surfaced first.
        </p>

        <div className="space-y-5">
          <Input
            label="Title"
            placeholder="One clear question, e.g. 'Why add speeds in opposite directions?'"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={posting}
          />

          <Textarea
            label="Details"
            placeholder="What did you try? Where exactly does it break down?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={posting}
            className="min-h-32"
          />

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Concept <span className="text-text-muted font-normal">(optional but recommended)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {concepts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setConceptId(conceptId === c.id ? undefined : c.id)}
                  disabled={posting}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                    conceptId === c.id
                      ? 'bg-accent-subtle border-accent text-accent'
                      : 'border-border text-text-secondary hover:border-border-strong'
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <Button
            size="lg"
            fullWidth
            loading={posting}
            disabled={!title.trim()}
            onClick={handlePost}
          >
            Post Doubt
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
