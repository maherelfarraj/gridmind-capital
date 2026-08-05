-- GM-G3: retire the superseded finalize_gate_decision RPC.
--
-- finalize_gate_decision only performed the phase/submission writes; the server
-- action did the step/approval writes separately, so a gate decision was NOT
-- atomic. decide_gate_approval (20260805190001) performs the ENTIRE decision in
-- one transaction and is the sole gate-decision RPC. This migration sorts AFTER
-- both the original finalize migration (20260805180756) and the new RPC, so on
-- a fresh replay finalize is created then dropped -- leaving exactly one gate
-- RPC.
DROP FUNCTION IF EXISTS public.finalize_gate_decision(uuid, integer, uuid, text, uuid, text);
