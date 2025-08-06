import React, { useState, useEffect } from 'react';
import TeamEditorModal from '../../components/TeamEditorModal';
import { getFirestore, collection, doc, getDocs, setDoc } from 'firebase/firestore';

const roleLabels = {
  teamLeader: 'Team Leader',
  emt1: 'EMT 1',
  emt2: 'EMT 2',
  ambulanceDriver: 'Ambulance Driver',
};

const defaultTeamDeck = {
  teamLeader: null,
  emt1: null,
  emt2: null,
  ambulanceDriver: null,
};

export default function TeamOrganizerView() {
  const [responders, setResponders] = useState([]);
  const [teams, setTeams] = useState({ alpha: [], bravo: [] });
  const [selectedTeamKey, setSelectedTeamKey] = useState(null);
  const [selectedDeckIndex, setSelectedDeckIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const db = getFirestore();

  useEffect(() => {
    const loadTeams = async () => {
      const snapshot = await getDocs(collection(db, 'teams'));
      const rawTeams = { alpha: [], bravo: [] };

      snapshot.forEach(docSnap => {
        const [teamKey, index] = docSnap.id.split('-');
        const idx = parseInt(index, 10);
        if (!rawTeams[teamKey]) return;
        rawTeams[teamKey][idx] = { ...defaultTeamDeck, ...docSnap.data() };
      });

      // Fill any empty teams
      ['alpha', 'bravo'].forEach(teamKey => {
        if ((rawTeams[teamKey]?.length || 0) === 0) {
          rawTeams[teamKey] = [{ ...defaultTeamDeck, createdAt: new Date().toISOString(), }];
        }
      });

      setTeams(rawTeams);
    };

    const loadResponders = async () => {
      const snapshot = await getDocs(collection(db, 'mdrrmo-users'));
      const allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      const filtered = allUsers.filter(
        u => u.role?.toLowerCase() === 'responder' && u.status !== 'inactive'
      );
      setResponders(filtered);
    };

    loadTeams();
    loadResponders();
  }, []);

  const handleEdit = (teamKey, deckIndex) => {
    setSelectedTeamKey(teamKey);
    setSelectedDeckIndex(deckIndex);
    setIsModalOpen(true);
  };

  const handleSave = async (teamKey, deckIndex, updatedDeck) => {
  const docId = `${teamKey}-${deckIndex}`;

  // Step 1: Set all decks of this team to `currentTeam: false`
  const teamSnapshots = await getDocs(collection(db, 'teams'));
    const batchUpdates = [];

    teamSnapshots.forEach(docSnap => {
      if (docSnap.id.startsWith(teamKey)) {
        const docRef = doc(db, 'teams', docSnap.id);
        batchUpdates.push(setDoc(docRef, { ...docSnap.data(), currentTeam: false }));
      }
    });

    // Apply batch updates first
    await Promise.all(batchUpdates);

    // Step 2: Mark selected deck as currentTeam
    const deckWithTimestamp = {
      ...updatedDeck,
      currentTeam: true,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'teams', docId), deckWithTimestamp);

    setTeams(prev => {
      const updated = { ...prev };
      updated[teamKey][deckIndex] = deckWithTimestamp;
      return updated;
    });
  };

  return (
    <div className="team-organizer-container">
      <h2>Team Organizer</h2>
      <div className="teams-container">
        {['alpha', 'bravo'].map(teamKey => (
          <div key={teamKey} className="team-section">
            <h3>{`Team ${teamKey.toUpperCase()}`}</h3>
            {teams[teamKey]?.map((deck, idx) => (
              <div className={`deck-card ${deck.currentTeam ? 'active' : ''}`} key={idx}>
                <div className="deck-header">
                  <div className="deck-title-group">
                    <strong>Deck {idx + 1}</strong>
                  </div>
                  <div className="deck-controls">
                    <button className="edit-button" onClick={() => handleEdit(teamKey, idx)}>
                      ✏️ Edit
                    </button>
                  </div>
                </div>
                <div className="deck-body">
                  {Object.entries(roleLabels).map(([roleKey, label]) => {
                    const iconMap = {
                      teamLeader: 'fas fa-user-shield',
                      emt1: 'fas fa-user-nurse',
                      emt2: 'fas fa-user-nurse',
                      ambulanceDriver: 'fas fa-ambulance',
                    };
                    const user = deck[roleKey];
                    return (
                      <div key={roleKey} className="deck-role">
                        <i className={iconMap[roleKey]}></i>
                        <span className="role-label">{label}</span>
                        <span className="role-name">
                          {user?.fullName || <span className="unassigned">Not assigned</span>}
                        </span>
                      </div>
                    );
                  })}
                  {deck.createdAt && (
                    <p className="text-sm text-gray-500 mt-1">
                      Created: {new Date(deck.createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {(() => {
        const assignedUids = new Set();
        Object.values(teams).forEach(teamDecks => {
          teamDecks.forEach(deck => {
            Object.values(deck).forEach(role => {
              if (role?.uid) {
                assignedUids.add(role.uid);
              }
            });
          });
        });

        const currentDeck = teams[selectedTeamKey]?.[selectedDeckIndex];
        const filteredResponders = responders.filter(responder => {
          return (
            !assignedUids.has(responder.uid) ||
            Object.values(currentDeck || {}).some(role => role?.uid === responder.uid)
          );
        });

        return (
          <TeamEditorModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            teamDate={selectedTeamKey}
            currentTeam={currentDeck}
            responders={filteredResponders}
            onSave={(teamKey, data) => {
              handleSave(teamKey, selectedDeckIndex, data);
              setIsModalOpen(false);
            }}
            teams={teams}
            selectedTeamKey={selectedTeamKey}
            selectedDeckIndex={selectedDeckIndex}
          />
        );
      })()}
    </div>
  );
}
