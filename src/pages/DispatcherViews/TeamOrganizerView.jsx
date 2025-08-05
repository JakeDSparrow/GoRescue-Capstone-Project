import React, { useState, useEffect } from 'react';
import TeamEditorModal from '../../components/TeamEditorModal';
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

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

    const now = new Date();
    const rotatedTeams = {};

    for (const teamKey of ['alpha', 'bravo']) {
      const decks = rawTeams[teamKey] || [];

      // Sort decks by index to be safe
      const sortedDecks = decks.sort((a, b) => {
        const aDate = new Date(a?.createdAt || 0);
        const bDate = new Date(b?.createdAt || 0);
        return aDate - bDate;
      });

      // If first deck is expired, rotate
      const firstDeck = sortedDecks[0];
      const isExpired = firstDeck?.createdAt &&
        now - new Date(firstDeck.createdAt) > 24 * 60 * 60 * 1000;

      if (isExpired) {
        const rotated = [
          sortedDecks[1] || { ...defaultTeamDeck },
          sortedDecks[2] || { ...defaultTeamDeck },
          { ...defaultTeamDeck, createdAt: now.toISOString() }, // new empty deck
        ];

        // Overwrite Firestore with new order
        await Promise.all(
          rotated.map((deck, i) =>
            setDoc(doc(db, 'teams', `${teamKey}-${i}`), deck)
          )
        );

        rotatedTeams[teamKey] = rotated;
      } else {
        rotatedTeams[teamKey] = sortedDecks;
      }
    }

    setTeams(rotatedTeams);
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

    const deckWithTimestamp = {
      ...updatedDeck,
      createdAt: updatedDeck.createdAt || new Date().toISOString(),
    };

    await setDoc(doc(db, 'teams', docId), deckWithTimestamp);

    setTeams(prev => {
      const updated = { ...prev };
      updated[teamKey][deckIndex] = deckWithTimestamp;
      return updated;
    });
  };


  const addDeck = (teamKey) => {
    setTeams(prev => {
      if (prev[teamKey].length >= 3) {
        alert('Each team can only have a maximum of 3 decks.');
        return prev;
      }

      const updated = { ...prev };
      updated[teamKey] = [...updated[teamKey], { ...defaultTeamDeck }];
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
                {/* Deck Header */}
                <div className="deck-header">
                  <div className="deck-title-group">
                    <strong>Deck {idx + 1}</strong>
                    {deck.createdAt && (
                      <span className="deck-timestamp">
                        • Created: {new Date(deck.createdAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="deck-controls">
                    <button className="edit-button" onClick={() => handleEdit(teamKey, idx)}>
                      ✏️ Edit
                    </button>
                  </div>
                </div>

                {/* Deck Body */}
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
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {(() => {
          const assignedUids = new Set();

          // Go through all decks in all teams
          Object.values(teams).forEach(teamDecks => {
            teamDecks.forEach(deck => {
              Object.values(deck).forEach(role => {
                if (role?.uid) {
                  assignedUids.add(role.uid);
                }
              });
            });
          });

          // Get current deck (so we can allow its members to stay selectable)
          const currentDeck = teams[selectedTeamKey]?.[selectedDeckIndex];

          // Build a filtered list of responders
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
            />
          );
        })()}
    </div>
  );
}
