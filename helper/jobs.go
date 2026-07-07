package main

import (
	"strconv"
	"sync"
)

type jobState string

const (
	jobRunning jobState = "running"
	jobDone    jobState = "done"
	jobError   jobState = "error"
)

type job struct {
	ID       string   `json:"jobId"`
	State    jobState `json:"state"`
	Progress int      `json:"progress"` // 0..100
	Message  string   `json:"message"`
}

type jobStore struct {
	mu   sync.Mutex
	seq  int
	jobs map[string]*job
}

func newJobStore() *jobStore {
	return &jobStore{jobs: map[string]*job{}}
}

func (s *jobStore) create() *job {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.seq++
	j := &job{ID: strconv.Itoa(s.seq), State: jobRunning, Progress: 0}
	s.jobs[j.ID] = j
	return j
}

func (s *jobStore) update(id string, fn func(*job)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if j, ok := s.jobs[id]; ok {
		fn(j)
	}
}

func (s *jobStore) get(id string) (job, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	j, ok := s.jobs[id]
	if !ok {
		return job{}, false
	}
	return *j, true
}
