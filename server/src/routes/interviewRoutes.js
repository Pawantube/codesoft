import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInterview, addNote, setTranscript, summarize, transcribeAudio, getInterviewICS } from '../controllers/interviewController.js';
import { uploadAudio } from '../middleware/upload.js';

const router = Router();
router.use(requireAuth);

router.get('/:applicationId', getInterview);
router.post('/:applicationId/notes', addNote);
router.post('/:applicationId/transcript', setTranscript);
router.post('/:applicationId/summarize', summarize);
router.post('/:applicationId/transcribe', uploadAudio, transcribeAudio);
router.get('/:applicationId/ics', getInterviewICS);

export default router;
