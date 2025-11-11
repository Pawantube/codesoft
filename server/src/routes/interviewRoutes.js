import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInterview, addNote, setTranscript, summarize, transcribeAudio, getInterviewICS, getInterviewMeta, setQuestions, generateScorecard } from '../controllers/interviewController.js';
import { uploadAudio } from '../middleware/upload.js';

const router = Router();
router.use(requireAuth);

router.get('/:applicationId', getInterview);
router.get('/:applicationId/meta', getInterviewMeta);
router.post('/:applicationId/notes', addNote);
router.post('/:applicationId/transcript', setTranscript);
router.post('/:applicationId/questions', setQuestions);
router.post('/:applicationId/summarize', summarize);
router.post('/:applicationId/scorecard', generateScorecard);
router.post('/:applicationId/transcribe', uploadAudio, transcribeAudio);
router.get('/:applicationId/ics', getInterviewICS);

export default router;
