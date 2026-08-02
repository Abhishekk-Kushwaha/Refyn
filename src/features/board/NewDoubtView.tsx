import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button, Icon, Input, Textarea } from '@/components/ui';
import { useToast } from '@/components/feedback';
import { postDoubt } from '@/services/doubts.service';
import { getSubtopicOptions } from '@/services/taxonomy.service';
import { useAuthStore } from '@/stores/authStore';
import { useExamStore } from '@/stores/examStore';
import { getErrorMessage } from '@/lib/errors';
import clsx from 'clsx';

export const NewDoubtView = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const user = useAuthStore((s) => s.session?.user);
  const isDemo = useAuthStore((s) => s.isDemo);
  const examId = useExamStore((s) => s.selectedExamId) ?? 'cat';

  // Real accounts tag against the seeded 126-subtopic taxonomy; demo mode
  // uses the mock bank's concepts.
  const { data: concepts = [] } = useQuery({
    queryKey: ['subtopic-options', isDemo],
    queryFn: () => getSubtopicOptions(!isDemo && !!user),
    staleTime: Infinity,
  });

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
    <div className="mx-auto w-full max-w-[760px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => navigate('/board')}
          className="mb-6 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 -ml-2 font-body text-[0.8125rem] font-medium text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          <Icon name="arrowLeft" size={15} />
          Back to board
        </button>

        <h1 className="font-display text-[2rem] font-bold tracking-[-0.035em] text-text-primary">
          Ask a doubt
        </h1>
        <p className="mb-8 mt-2 font-body text-[0.9375rem] text-text-secondary">
          Tag the concept — answerers with proven accuracy in it get surfaced first.
        </p>

        <div className="space-y-6 rounded-2xl border border-border bg-surface p-6 lg:p-7">
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
            <span className="mb-2.5 block font-body text-[0.8125rem] font-semibold text-text-primary">
              Concept{' '}
              <span className="font-normal text-text-muted">(optional but recommended)</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {concepts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setConceptId(conceptId === c.id ? undefined : c.id)}
                  disabled={posting}
                  aria-pressed={conceptId === c.id}
                  className={clsx(
                    'rounded-full border px-3.5 py-1.5 font-body text-[0.8125rem] font-medium transition-colors',
                    conceptId === c.id
                      ? 'border-accent bg-accent-subtle text-accent'
                      : 'border-border text-text-secondary hover:border-border-strong hover:text-text-primary'
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-border pt-6 sm:flex-row-reverse">
            <Button
              size="lg"
              loading={posting}
              disabled={!title.trim()}
              onClick={handlePost}
              className="sm:min-w-40"
            >
              Post doubt
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => navigate('/board')}
              disabled={posting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
