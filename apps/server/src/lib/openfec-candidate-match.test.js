import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCandidateMatch, selectBestCandidateMatch } from './openfec-candidate-match.js';

test('selectBestCandidateMatch prefers an exact name/state/branch match', () => {
	const result = selectBestCandidateMatch(
		[
			{
				candidate_id: 'H0CA12345',
				name: 'DOE, JANE',
				state: 'CA',
				office: 'H',
				party_full: 'DEMOCRAT',
				election_years: [2024]
			},
			{
				candidate_id: 'S0TX99999',
				name: 'DOE, JANE',
				state: 'TX',
				office: 'S',
				party_full: 'DEMOCRAT',
				election_years: [2024]
			}
		],
		{
			fullName: 'Doe, Jane',
			state: 'CA',
			branch: 'House of Representatives',
			party: 'Democrat'
		}
	);

	assert.equal(result.reason, 'matched');
	assert.equal(result.match?.candidate_id, 'H0CA12345');
});

test('evaluateCandidateMatch rejects state mismatches', () => {
	const result = evaluateCandidateMatch(
		{
			candidate_id: 'H0TX99999',
			name: 'DOE, JANE',
			state: 'TX',
			office: 'H'
		},
		{
			fullName: 'Doe, Jane',
			state: 'CA',
			branch: 'House of Representatives'
		}
	);

	assert.equal(result.reason, 'state-mismatch');
	assert.equal(result.score, -Infinity);
});

test('evaluateCandidateMatch rejects chamber mismatches', () => {
	const result = evaluateCandidateMatch(
		{
			candidate_id: 'S0CA99999',
			name: 'DOE, JANE',
			state: 'CA',
			office: 'S'
		},
		{
			fullName: 'Doe, Jane',
			state: 'CA',
			branch: 'House of Representatives'
		}
	);

	assert.equal(result.reason, 'branch-mismatch');
	assert.equal(result.score, -Infinity);
});

test('selectBestCandidateMatch returns null for ambiguous close matches', () => {
	const result = selectBestCandidateMatch(
		[
			{
				candidate_id: 'H0CA11111',
				name: 'DOE, JANE',
				state: 'CA',
				office: 'H',
				election_years: [2024]
			},
			{
				candidate_id: 'H0CA22222',
				name: 'DOE, JANE MARIE',
				state: 'CA',
				office: 'H',
				election_years: [2024]
			}
		],
		{
			fullName: 'Doe, Jane',
			state: 'CA',
			branch: 'House of Representatives'
		}
	);

	assert.equal(result.reason, 'ambiguous');
	assert.equal(result.match, null);
});
