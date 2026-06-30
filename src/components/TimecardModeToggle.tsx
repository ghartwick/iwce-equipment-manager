import { useNavigate } from 'react-router-dom';
import { Clock, ClipboardList } from 'lucide-react';

interface TimecardModeToggleProps {
  mode: 'field' | 'survey';
}

export function TimecardModeToggle({ mode }: TimecardModeToggleProps) {
  const navigate = useNavigate();

  const baseBtn = 'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors';
  const active = 'bg-yellow-600 text-black';
  const inactive = 'text-yellow-100 dark:text-yellow-300 hover:bg-yellow-600/60 dark:hover:bg-yellow-800';

  return (
    <div className="inline-flex items-center gap-1 p-1 bg-yellow-800/40 dark:bg-black border border-yellow-500 dark:border-yellow-700 rounded-lg">
      <button
        type="button"
        onClick={() => mode !== 'field' && navigate('/timecard')}
        className={`${baseBtn} ${mode === 'field' ? active : inactive}`}
        aria-pressed={mode === 'field'}
      >
        <Clock className="h-4 w-4" />
        Field
      </button>
      <button
        type="button"
        onClick={() => mode !== 'survey' && navigate('/survey-timecard')}
        className={`${baseBtn} ${mode === 'survey' ? active : inactive}`}
        aria-pressed={mode === 'survey'}
      >
        <ClipboardList className="h-4 w-4" />
        Survey
      </button>
    </div>
  );
}
