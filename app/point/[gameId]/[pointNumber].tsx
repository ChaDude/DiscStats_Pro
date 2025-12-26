import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Modal, AlertButton } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useState, useEffect, useRef, useMemo } from 'react';
import { getDB } from '../../../database/db';

type Game = {
  id: number;
  teamName: string;
  opponentName: string;
  teamId: number | null;
  teamSize: number;
  startingPuller: string;
  genderRule: string; 
};

type Player = {
  id: number;
  firstName: string;
  lastName: string;
  number: number | null;
  gender: 'male' | 'female' | 'other';
};

type Event = {
  id: number;
  eventType: string;
  throwerId: number | null;
  receiverId: number | null;
  defenderId: number | null;
  timestamp: string;
};

type LinePlayer = {
  id: number;
  role: 'male' | 'female';
};

// The State Machine
type GameState = 'awaiting_pull' | 'defense' | 'awaiting_pickup' | 'offense';

export default function PointTrackingScreen() {
  const { gameId, pointNumber } = useLocalSearchParams<{ gameId: string; pointNumber: string }>();
  const router = useRouter();
  const pNum = parseInt(pointNumber, 10);

  const [game, setGame] = useState<Game | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [line, setLine] = useState<LinePlayer[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  
  // Game State
  const [gameState, setGameState] = useState<GameState>('awaiting_pull');
  const [currentHolderId, setCurrentHolderId] = useState<number | null>(null);
  const [startingOnOffense, setStartingOnOffense] = useState(false);
  
  // Modals & Metadata
  const [lineModalVisible, setLineModalVisible] = useState(false);
  const [pullModalVisible, setPullModalVisible] = useState(false);
  const [pullStep, setPullStep] = useState<'who' | 'outcome'>('who');
  const [pullerId, setPullerId] = useState<number | null>(null);
  const [targetRatio, setTargetRatio] = useState<{m: number, f: number}>({m: 4, f: 3});
  const [ratioLocked, setRatioLocked] = useState(false); 

  // Scores
  const [ourScore, setOurScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [startOurScore, setStartOurScore] = useState(0); 
  const [startOpponentScore, setStartOpponentScore] = useState(0);

  const scrollRef = useRef<ScrollView>(null);

  // --- Helpers ---
  const getDisplayName = (player: Player | undefined, short: boolean) => {
      if (!player) return 'Unknown';
      if (short) {
          return `${player.firstName} ${player.lastName ? player.lastName.charAt(0) + '.' : ''}`.trim();
      }
      return `${player.firstName} ${player.lastName || ''}`.trim();
  };

  const getLineCounts = () => {
    let m = 0, f = 0;
    line.forEach(lp => {
      if (lp.role === 'male') m++;
      else f++;
    });
    return { m, f };
  };

  // --- Data Loading ---
  const loadData = async () => {
    try {
      const db = await getDB();
      const gameResult = await db.getFirstAsync<Game>('SELECT * FROM games WHERE id = ?', [gameId]);
      setGame(gameResult);

      if (gameResult?.teamId) {
        const playersResult = await db.getAllAsync<Player>(
          `SELECT p.id, p.firstName, p.lastName, p.number, p.gender
           FROM players p
           JOIN team_players tp ON p.id = tp.playerId
           WHERE tp.teamId = ?
           ORDER BY p.firstName`,
          [gameResult.teamId]
        );
        setRoster(playersResult);
      }

      // Determine Start State
      let initialOurScore = 0, initialOpponentScore = 0, weArePulling = false;
      if (pNum === 1) {
        weArePulling = gameResult?.startingPuller === 'our';
      } else {
        const prevPoint = await db.getFirstAsync<{ ourScoreAfter: number, opponentScoreAfter: number }>(
          'SELECT ourScoreAfter, opponentScoreAfter FROM points WHERE gameId = ? AND pointNumber = ?',
          [gameId, pNum - 1]
        );
        if (prevPoint) {
            initialOurScore = prevPoint.ourScoreAfter;
            initialOpponentScore = prevPoint.opponentScoreAfter;
            const lastEvent = await db.getFirstAsync<{ eventType: string }>(
                'SELECT eventType FROM events WHERE pointId = (SELECT id FROM points WHERE gameId=? AND pointNumber=?) ORDER BY id DESC LIMIT 1',
                [gameId, pNum - 1]
            );
            weArePulling = (lastEvent?.eventType === 'goal' || lastEvent?.eventType === 'callahan');
        }
      }
      setStartOurScore(initialOurScore);
      setStartOpponentScore(initialOpponentScore);
      setOurScore(initialOurScore);
      setOpponentScore(initialOpponentScore);
      setStartingOnOffense(!weArePulling);

      // ABBA Logic
      const teamSize = gameResult?.teamSize || 7;
      let defaultM = Math.ceil(teamSize / 2);
      let defaultF = Math.floor(teamSize / 2);
      let isLocked = false;
      if (gameResult?.genderRule === 'abba') {
         if (pNum === 1) { isLocked = false; } else {
             isLocked = true;
             const p1 = await db.getFirstAsync<{ genderRatio: string }>('SELECT genderRatio FROM points WHERE gameId = ? AND pointNumber = 1', [gameId]);
             const p1Str = p1?.genderRatio || `${defaultM}m${defaultF}f`;
             const mMatch = p1Str.match(/(\d+)m/);
             const p1M = mMatch ? parseInt(mMatch[1]) : defaultM;
             const cycle = Math.floor((pNum - 2) / 2) % 2; 
             const isSwap = cycle === 0; 
             const p1MaleHeavy = p1M > (teamSize / 2);
             if (isSwap) { defaultM = p1MaleHeavy ? Math.floor(teamSize / 2) : Math.ceil(teamSize / 2); defaultF = teamSize - defaultM; } 
             else { defaultM = p1MaleHeavy ? Math.ceil(teamSize / 2) : Math.floor(teamSize / 2); defaultF = teamSize - defaultM; }
         }
         setTargetRatio({ m: defaultM, f: defaultF });
         setRatioLocked(isLocked);
      }

      // Load Point
      const pointResult = await db.getFirstAsync<{ id: number; linePlayers: string | null; startingOLine: boolean; genderRatio: string }>(
        'SELECT * FROM points WHERE gameId = ? AND pointNumber = ?',
        [gameId, pointNumber]
      );

      if (pointResult) {
        const eventsResult = await db.getAllAsync<Event>('SELECT * FROM events WHERE pointId = ? ORDER BY timestamp', [pointResult.id]);
        setEvents(eventsResult);
        
        if (pointResult.linePlayers) {
          const rawLine = JSON.parse(pointResult.linePlayers);
          if (rawLine.length > 0 && typeof rawLine[0] === 'number') {
             setLine(rawLine.map((id: number) => ({ id, role: 'male' }))); 
          } else {
             setLine(rawLine);
          }
        }
        
        if (gameResult?.genderRule === 'abba' && pointResult.genderRatio) {
            const mMatch = pointResult.genderRatio.match(/(\d+)m/);
            const fMatch = pointResult.genderRatio.match(/(\d+)f/);
            if (mMatch && fMatch) setTargetRatio({ m: parseInt(mMatch[1]), f: parseInt(fMatch[1]) });
        }

        // --- Reconstruct Game State from Event Log ---
        if (eventsResult.length === 0) {
            if (pointResult.startingOLine) setGameState('awaiting_pickup'); 
            else setGameState('awaiting_pull');
        } else {
            let lastState: GameState = 'defense';
            let holder: number | null = null;

            eventsResult.forEach(e => {
                if (e.eventType === 'pull') lastState = 'defense';
                else if (e.eventType === 'pull_ob') lastState = 'awaiting_pickup';
                else if (e.eventType === 'pickup') { lastState = 'offense'; holder = e.throwerId; }
                else if (e.eventType === 'pass') { lastState = 'offense'; holder = e.receiverId; }
                else if (e.eventType === 'drop') { lastState = 'defense'; holder = null; }
                else if (e.eventType === 'throwaway') { lastState = 'defense'; holder = null; }
                else if (e.eventType === 'stall') { lastState = 'defense'; holder = null; }
                else if (e.eventType === 'd') { lastState = 'awaiting_pickup'; holder = null; }
                else if (e.eventType === 'interception') { lastState = 'offense'; holder = e.defenderId; }
                else if (e.eventType === 'opp_turn') { lastState = 'awaiting_pickup'; holder = null; }
                else if (e.eventType === 'goal') { lastState = 'awaiting_pull'; holder = null; }
                else if (e.eventType === 'callahan') { lastState = 'awaiting_pull'; holder = null; }
                else if (e.eventType === 'opp_goal') { lastState = 'awaiting_pull'; holder = null; }
            });
            setGameState(lastState);
            setCurrentHolderId(holder);
        }

      } else {
        // New Point
        setGameState(weArePulling ? 'awaiting_pull' : 'awaiting_pickup');
        setLineModalVisible(true);
      }

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load point.');
    }
  };

  useEffect(() => { loadData(); }, [gameId, pointNumber]);
  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [events]);

  // Trigger Pull Modal if we are pulling
  useEffect(() => {
    if (!lineModalVisible && gameState === 'awaiting_pull' && events.length === 0 && line.length > 0) {
        setPullStep('who');
        setPullModalVisible(true);
    }
  }, [lineModalVisible, gameState, events, line]);


  // --- DB Operations ---
  const saveEvent = async (type: string, thrower: number|null, receiver: number|null, defender: number|null) => {
      const db = await getDB();
      const pointRow = await db.getFirstAsync<{id: number}>('SELECT id FROM points WHERE gameId = ? AND pointNumber = ?', [gameId, pointNumber]);
      if (!pointRow) return;

      const t = (thrower ?? null) as number | null;
      const r = (receiver ?? null) as number | null;
      const d = (defender ?? null) as number | null;

      await db.runAsync(
          'INSERT INTO events (pointId, eventType, throwerId, receiverId, defenderId, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
          [pointRow.id, type, t, r, d]
      );
      await loadData();
  };

  const updateLastEvent = async (newType: string) => {
      const db = await getDB();
      const lastEvent = events[events.length - 1];
      if (!lastEvent) return;

      await db.runAsync('UPDATE events SET eventType = ? WHERE id = ?', [newType, lastEvent.id]);
      await loadData();
  };

  const recordCallahan = async (playerId: number) => {
      await saveEvent('callahan', null, null, playerId);
      const db = await getDB();
      const pid = (await db.getFirstAsync<{id:number}>('SELECT id FROM points WHERE gameId=? AND pointNumber=?', [gameId, pointNumber]))?.id;
      if(pid) await db.runAsync('UPDATE points SET ourScoreAfter=?, opponentScoreAfter=? WHERE id=?', [ourScore+1, opponentScore, pid]);
      router.back();
  };

  // --- Interactions ---

  const handleGridTap = (player: Player) => {
      if (gameState === 'offense') {
          // PASS (Optimistic: Assume catch)
          if (currentHolderId === player.id) return; 
          saveEvent('pass', currentHolderId, player.id, null);
      } 
      else if (gameState === 'defense') {
          // DEFENSIVE PLAY MENU
          Alert.alert(
              `Defensive Play: ${getDisplayName(player, true)}`,
              'Select action:',
              [
                  { text: 'Block (Knockdown)', onPress: () => saveEvent('d', null, null, player.id) },
                  { text: 'Interception', onPress: () => {
                      const run = async () => { await saveEvent('interception', null, null, player.id); };
                      run();
                  }},
                  { text: 'Callahan (Goal)', onPress: () => {
                      const run = async () => { await recordCallahan(player.id); };
                      run();
                  }},
                  { text: 'Cancel', style: 'cancel' }
              ]
          );
      }
      else if (gameState === 'awaiting_pickup') {
          // PICKUP
          saveEvent('pickup', player.id, null, null);
      }
  };

  const handleAction = (action: string) => {
      if (action === 'throwaway') {
          saveEvent('throwaway', currentHolderId, null, null);
      }
      else if (action === 'stall') {
          saveEvent('stall', currentHolderId, null, null);
      }
      else if (action === 'drop') {
          // CONVERT LAST PASS TO DROP
          const last = events[events.length - 1];
          if (last && last.eventType === 'pass') {
              updateLastEvent('drop');
          } else {
              Alert.alert("Error", "Can only record a drop immediately after a pass.");
          }
      }
      else if (action === 'goal') {
          // CONVERT LAST PASS TO GOAL
          const last = events[events.length - 1];
          if (last && last.eventType === 'pass') {
              Alert.alert("Goal!", `Confirm goal for ${getDisplayName(roster.find(p=>p.id===last.receiverId), true)}?`, [
                  { text: "Confirm", onPress: async () => {
                      await updateLastEvent('goal');
                      const db = await getDB();
                      const pid = (await db.getFirstAsync<{id:number}>('SELECT id FROM points WHERE gameId=? AND pointNumber=?', [gameId, pointNumber]))?.id;
                      if(pid) await db.runAsync('UPDATE points SET ourScoreAfter=?, opponentScoreAfter=? WHERE id=?', [ourScore+1, opponentScore, pid]);
                      router.back();
                  }},
                  { text: "Cancel", style: 'cancel' }
              ]);
          } else {
              Alert.alert("Error", "Can only record a goal immediately after a pass.");
          }
      }
      else if (action === 'opp_turn') {
          saveEvent('opp_turn', null, null, null);
      }
      else if (action === 'opp_goal') {
          Alert.alert('Opponent Scored', 'Confirm?', [
              { text: 'Confirm', onPress: async () => {
                  await saveEvent('opp_goal', null, null, null);
                  const db = await getDB();
                  const pid = (await db.getFirstAsync<{id:number}>('SELECT id FROM points WHERE gameId=? AND pointNumber=?', [gameId, pointNumber]))?.id;
                  if(pid) await db.runAsync('UPDATE points SET ourScoreAfter=?, opponentScoreAfter=? WHERE id=?', [ourScore, opponentScore+1, pid]);
                  router.back();
              }},
              { text: 'Cancel', style: 'cancel'}
          ]);
      }
  };

  const undoLastEvent = async () => {
      const db = await getDB();
      const last = events[events.length-1];
      if (last) {
          await db.runAsync('DELETE FROM events WHERE id=?', [last.id]);
          await loadData();
      }
  };

  const saveLine = async (newLine: LinePlayer[]) => {
    const issues: string[] = [];
    const teamSize = game?.teamSize || 7;
    if (newLine.length !== teamSize) issues.push(`• Player Count: ${newLine.length}/${teamSize}`);
    if (game?.genderRule === 'abba') {
        let m = 0, f = 0;
        newLine.forEach(lp => lp.role === 'male' ? m++ : f++);
        if (m !== targetRatio.m || f !== targetRatio.f) issues.push(`• Gender Ratio: ${m}M/${f}F (Target: ${targetRatio.m}M/${targetRatio.f}F)`);
    }
    if (issues.length > 0) {
        Alert.alert('Line Issues', `The following checks failed:\n\n${issues.join('\n')}\n\nSave anyway?`, [{ text: 'Fix Line', style: 'cancel' }, { text: 'Save Anyway', style: 'destructive', onPress: () => persistLine(newLine) }]);
        return;
    }
    await persistLine(newLine);
  };

  const persistLine = async (newLine: LinePlayer[]) => {
    const db = await getDB();
    const pointRow = await db.getFirstAsync('SELECT id FROM points WHERE gameId = ? AND pointNumber = ?', [gameId, pointNumber]);
    let m = 0, f = 0; newLine.forEach(lp => lp.role === 'male' ? m++ : f++);
    const calculatedRatio = `${m}m${f}f`;
    
    const startO = startingOnOffense ? 1 : 0;

    if (!pointRow) {
      await db.runAsync('INSERT INTO points (gameId, pointNumber, ourScoreAfter, opponentScoreAfter, startingOLine, linePlayers, genderRatio) VALUES (?, ?, ?, ?, ?, ?, ?)', [gameId, pointNumber, startOurScore, startOpponentScore, startO, JSON.stringify(newLine), calculatedRatio]);
    } else {
      await db.runAsync('UPDATE points SET linePlayers = ?, genderRatio = ? WHERE gameId = ? AND pointNumber = ?', [JSON.stringify(newLine), calculatedRatio, gameId, pointNumber]);
    }
    setLine(newLine);
    setLineModalVisible(false);
  };

  const recordPull = async (outcome: 'good' | 'ob') => {
      try {
        const db = await getDB();
        const pointResult = await db.getFirstAsync<{ id: number }>('SELECT id FROM points WHERE gameId = ? AND pointNumber = ?', [gameId, pointNumber]);
        if (!pointResult) return; 
        const eventType = outcome === 'ob' ? 'pull_ob' : 'pull';
        
        const pid = (pullerId ?? null) as number | null;

        await db.runAsync('INSERT INTO events (pointId, eventType, throwerId, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', [pointResult.id, eventType, pid]);
        setPullModalVisible(false); await loadData(); 
    } catch (e) { Alert.alert("Error", "Failed to record pull"); }
  };

  const togglePlayerInLine = (player: Player) => {
    const existingIndex = line.findIndex(lp => lp.id === player.id);
    if (existingIndex >= 0) {
        const newLine = [...line]; newLine.splice(existingIndex, 1); setLine(newLine);
    } else {
        if (line.length >= (game?.teamSize || 7)) { Alert.alert('Line Full', `Maximum ${game?.teamSize || 7} players allowed.`); return; }
        if (player.gender === 'other') {
            Alert.alert('Select Matchup Role', `Is ${player.firstName} playing as MMP or FMP this point?`, [
                { text: 'MMP (Male)', onPress: () => setLine([...line, { id: player.id, role: 'male' }]) },
                { text: 'FMP (Female)', onPress: () => setLine([...line, { id: player.id, role: 'female' }]) },
                { text: 'Cancel', style: 'cancel' }
            ]);
        } else { setLine([...line, { id: player.id, role: player.gender as 'male' | 'female' }]); }
    }
  };

  const cycleTargetRatio = () => {
      if (ratioLocked || game?.genderRule !== 'abba') return;
      const size = game?.teamSize || 7;
      let newM = targetRatio.m; let newF = targetRatio.f;
      if (size === 7) { if (newM === 4) { newM = 3; newF = 4; } else { newM = 4; newF = 3; } }
      setTargetRatio({ m: newM, f: newF });
  };

  // Render Vars
  const currentCounts = useMemo(() => getLineCounts(), [line]);
  const isABBA = game?.genderRule === 'abba';
  const isLineFull = line.length === (game?.teamSize || 7);
  const isRatioCorrect = !isABBA || (currentCounts.m === targetRatio.m && currentCounts.f === targetRatio.f);
  const isLineValid = isLineFull && isRatioCorrect;

  // Header Status Logic
  const getHeaderStatus = () => {
      if (gameState === 'defense') return `${game?.opponentName} has the disc`;
      if (gameState === 'offense') return `${game?.teamName} has the disc`;
      if (gameState === 'awaiting_pickup') return 'Disc on Ground';
      if (gameState === 'awaiting_pull') return 'Ready for Pull';
      return '...';
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `Point ${pointNumber}` }} />

      <View style={styles.header}>
        <Text style={styles.pointTitle} numberOfLines={1} adjustsFontSizeToFit>Point {pointNumber}</Text>
        <Text style={styles.scoreText} numberOfLines={1} adjustsFontSizeToFit>{game?.teamName} {ourScore} - {opponentScore} {game?.opponentName}</Text>
        <Text style={styles.possessionText} numberOfLines={1} adjustsFontSizeToFit>
            {getHeaderStatus()}
        </Text>
      </View>

      <View style={styles.lineGridSection}>
        <View style={styles.lineHeader}>
          <Text style={styles.lineTitle}>Line ({line.length}/{game?.teamSize})</Text>
          <TouchableOpacity onPress={() => setLineModalVisible(true)}>
            <FontAwesome name="edit" size={20} color="#27ae60" />
          </TouchableOpacity>
        </View>
        <View style={styles.lineGrid}>
          {Array.from({ length: 8 }).map((_, index) => {
            const linePlayer = line[index];
            if (!linePlayer) return <View key={`empty-${index}`} style={styles.linePlayerEmpty} />;
            const player = roster.find(p => p.id === linePlayer.id);
            if (!player) return <View key={`empty-${index}`} style={styles.linePlayerEmpty} />;
            
            const isHolder = currentHolderId === player.id;

            return (
              <TouchableOpacity
                key={linePlayer.id}
                style={[
                    styles.linePlayerButton, 
                    isHolder && styles.holderButton,
                ]}
                onPress={() => handleGridTap(player)}
              >
                <Text style={[styles.linePlayerName, isHolder && styles.holderText]}>
                  {getDisplayName(player, true)}
                </Text>
                {isHolder && <FontAwesome name="circle" size={10} color="#fff" style={{marginTop: 4}} />}
                {game?.genderRule !== 'none' && (
                    <View style={styles.roleBadge}>
                       <Text style={styles.roleText}>{linePlayer.role === 'male' ? 'M' : 'F'}</Text>
                    </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.eventGridSection}>
        <View style={styles.eventGrid}>
          {gameState === 'offense' && (
             <>
               <TouchableOpacity style={styles.eventBtn} onPress={() => handleAction('goal')}>
                 <FontAwesome name="flag-checkered" size={28} color="#fff" />
                 <Text style={styles.eventText}>Goal</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.eventBtn} onPress={() => handleAction('throwaway')}>
                 <FontAwesome name="exclamation-triangle" size={28} color="#fff" />
                 <Text style={styles.eventText}>Turn</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.eventBtn} onPress={() => handleAction('drop')}>
                 <FontAwesome name="arrow-down" size={28} color="#fff" />
                 <Text style={styles.eventText}>Drop</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.eventBtn} onPress={() => handleAction('stall')}>
                 <FontAwesome name="hourglass-end" size={28} color="#fff" />
                 <Text style={styles.eventText}>Stall</Text>
               </TouchableOpacity>
             </>
          )}

          {gameState === 'defense' && (
             <>
               <TouchableOpacity style={styles.eventBtn} onPress={() => handleAction('opp_turn')}>
                 <FontAwesome name="random" size={28} color="#fff" />
                 <Text style={styles.eventText}>Opp Turn</Text>
               </TouchableOpacity>
               <TouchableOpacity style={[styles.eventBtn, { backgroundColor: '#e67e22' }]} onPress={() => handleAction('opp_goal')}>
                 <FontAwesome name="times-circle" size={28} color="#fff" />
                 <Text style={styles.eventText}>Opp Goal</Text>
               </TouchableOpacity>
             </>
          )}

          {/* Always show Undo */}
          <TouchableOpacity style={[styles.eventBtn, styles.undoBtn]} onPress={undoLastEvent}>
            <FontAwesome name="undo" size={28} color="#fff" />
            <Text style={styles.eventText}>Undo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.eventsSection}>
        <Text style={styles.eventsTitle}>Events ({events.length})</Text>
        <ScrollView ref={scrollRef} style={styles.eventsScroll}>
          {events.length === 0 ? (
             <Text style={styles.emptyEvents}>Waiting for start...</Text>
          ) : (
            events.map((event, index) => {
              const thrower = roster.find(p => p.id === event.throwerId);
              const receiver = roster.find(p => p.id === event.receiverId);
              const defender = roster.find(p => p.id === event.defenderId);
              
              let desc = event.eventType.toUpperCase();
              if (event.eventType === 'pass') desc = `${getDisplayName(thrower, false)} → ${getDisplayName(receiver, false)}`;
              if (event.eventType === 'pickup') desc = `Pickup: ${getDisplayName(thrower, false)}`;
              if (event.eventType === 'goal') desc = `GOAL: ${getDisplayName(thrower, false)} → ${getDisplayName(receiver, false)}`;
              if (event.eventType === 'throwaway') desc = `Turn: ${getDisplayName(thrower, false)}`;
              if (event.eventType === 'drop') desc = `Drop: ${getDisplayName(receiver, false)} (from ${getDisplayName(thrower, false)})`;
              if (event.eventType === 'd') desc = `D: ${getDisplayName(defender, false)}`;
              if (event.eventType === 'interception') desc = `Int: ${getDisplayName(defender, false)}`;

              return (
                <Text key={event.id} style={styles.eventItem}>
                  {index + 1}. {desc}
                </Text>
              );
            })
          )}
        </ScrollView>
      </View>

      <Modal visible={lineModalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Select Line ({line.length}/{game?.teamSize})</Text>
              <TouchableOpacity onPress={() => setLineModalVisible(false)} style={styles.closeModalBtn}>
                  <FontAwesome name="times" size={24} color="#7f8c8d" />
              </TouchableOpacity>
          </View>

          {game?.genderRule !== 'none' && (
              <View style={styles.ratioContainer}>
                  {isABBA ? (
                      <TouchableOpacity onPress={cycleTargetRatio} style={[styles.targetRatioBtn, ratioLocked && {opacity: 0.8, backgroundColor: '#f0f0f0'}]}>
                         <Text style={styles.ratioLabel}>
                             Target: <Text style={{fontWeight:'800', color: '#27ae60'}}>{targetRatio.m} Men / {targetRatio.f} Women</Text> 
                             {!ratioLocked ? " (Tap to Cycle)" : " (Locked 🔒)"}
                         </Text>
                      </TouchableOpacity>
                  ) : (
                      <Text style={[styles.ratioLabel, {marginBottom: 10}]}>Current Ratio:</Text>
                  )}
                  
                  <View style={styles.countsContainer}>
                      <Text style={[styles.countText, {color: isABBA ? (currentCounts.m === targetRatio.m ? '#3498db' : '#e74c3c') : '#3498db'}]}>
                         {isABBA ? `Selected: ${currentCounts.m}M` : `${currentCounts.m} Men`}
                      </Text>
                      <Text style={[styles.countText, {color: isABBA ? (currentCounts.f === targetRatio.f ? '#e91e63' : '#e74c3c') : '#e91e63'}]}>
                         {isABBA ? `/ ${currentCounts.f}F` : `/ ${currentCounts.f} Women`}
                      </Text>
                  </View>
              </View>
          )}

          <ScrollView contentContainerStyle={styles.rosterGrid}>
            {roster.map((player) => {
              const inLineObj = line.find(lp => lp.id === player.id);
              const isSelected = !!inLineObj;
              return (
              <TouchableOpacity
                key={player.id}
                style={[styles.rosterPlayer, isSelected && styles.rosterPlayerSelected]}
                onPress={() => togglePlayerInLine(player)}
              >
                {game?.genderRule !== 'none' && (
                    <View style={styles.genderIconBadge}>
                        {player.gender === 'male' && <FontAwesome name="male" size={16} color={isSelected ? "#fff" : "#3498db"} />}
                        {player.gender === 'female' && <FontAwesome name="female" size={16} color={isSelected ? "#fff" : "#e91e63"} />}
                        {player.gender === 'other' && <FontAwesome name="user" size={16} color={isSelected ? "#fff" : "#95a5a6"} />}
                    </View>
                )}
                <Text style={[styles.rosterPlayerName, isSelected && {color: '#fff'}]}>{getDisplayName(player, false)} #{player.number}</Text>
                {isSelected && (
                    <Text style={{color:'#fff', fontWeight:'bold', fontSize:12, marginTop:4}}>
                        Playing as: {inLineObj.role === 'male' ? 'MMP' : 'FMP'}
                    </Text>
                )}
              </TouchableOpacity>
            )})}
          </ScrollView>
          <TouchableOpacity
            style={[styles.saveLineBtn, !isLineValid && styles.saveLineBtnWarning]}
            onPress={() => saveLine(line)}
          >
            <Text style={styles.saveLineText}>Start Point</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={pullModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
           <View style={styles.pullModal}>
               {pullStep === 'who' ? (
                   <>
                       <Text style={styles.modalHeader}>Who Pulled?</Text>
                       <View style={styles.pullGrid}>
                           {line.map(lp => {
                               const p = roster.find(r => r.id === lp.id);
                               return (
                                   <TouchableOpacity key={lp.id} style={styles.pullPlayerBtn} onPress={() => { setPullerId(lp.id); setPullStep('outcome'); }}>
                                       <Text style={styles.pullPlayerName}>{p ? getDisplayName(p, true) : '?'}</Text>
                                   </TouchableOpacity>
                               )
                           })}
                       </View>
                   </>
               ) : (
                   <>
                       <Text style={styles.modalHeader}>Pull Outcome</Text>
                       <TouchableOpacity style={styles.outcomeBtn} onPress={() => recordPull('good')}>
                           <Text style={styles.outcomeText}>In Bounds (Good)</Text>
                       </TouchableOpacity>
                       <TouchableOpacity style={[styles.outcomeBtn, styles.obBtn]} onPress={() => recordPull('ob')}>
                           <Text style={styles.outcomeText}>Out of Bounds (Brick)</Text>
                       </TouchableOpacity>
                   </>
               )}
           </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: '#fff', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#ddd', height: 100, justifyContent: 'center' },
  pointTitle: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50' },
  scoreText: { fontSize: 24, fontWeight: 'bold', color: '#27ae60', marginVertical: 4 },
  possessionText: { fontSize: 16, color: '#27ae60', fontWeight: '600' },
  lineGridSection: { flex: 0.38, padding: 15, backgroundColor: '#fff' },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  lineTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  lineGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' },
  linePlayerButton: { backgroundColor: '#f0f0f0', width: '23%', aspectRatio: 1, margin: '1%', borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 3, position: 'relative' },
  linePlayerSelected: { backgroundColor: '#27ae60' }, // Standard selected
  holderButton: { backgroundColor: '#2ecc71', borderWidth: 2, borderColor: '#27ae60' }, // Highlight holder
  holderText: { color: '#fff' },
  linePlayerName: { fontSize: 14, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center' },
  linePlayerNumber: { fontSize: 12, color: '#7f8c8d', marginTop: 4 },
  linePlayerEmpty: { width: '23%', aspectRatio: 1, margin: '1%' },
  roleBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 4, borderRadius: 4 },
  roleText: { fontSize: 10, fontWeight: 'bold', color: '#333' },
  eventGridSection: { flex: 0.37, justifyContent: 'center', backgroundColor: '#f8f9fa' },
  eventGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 10 },
  eventBtn: { backgroundColor: '#34495e', width: 90, height: 90, borderRadius: 16, justifyContent: 'center', alignItems: 'center', margin: 6, elevation: 4 },
  undoBtn: { backgroundColor: '#e74c3c' },
  eventText: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginTop: 4, textAlign: 'center' },
  eventsSection: { flex: 0.25, paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#fff' },
  eventsTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', marginBottom: 10 },
  eventsScroll: { flex: 1 },
  emptyEvents: { fontSize: 16, color: '#7f8c8d', textAlign: 'center', marginTop: 20 },
  eventItem: { fontSize: 16, color: '#34495e', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  loading: { fontSize: 18, textAlign: 'center', marginTop: 50, color: '#7f8c8d' },
  
  modalContainer: { flex: 1, backgroundColor: '#f8f9fa', padding: 20, paddingTop: 60 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50' },
  closeModalBtn: { padding: 8 },
  rosterGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  rosterPlayer: { backgroundColor: '#fff', width: '45%', padding: 16, margin: 8, borderRadius: 12, alignItems: 'center', elevation: 2, position: 'relative' },
  rosterPlayerSelected: { backgroundColor: '#27ae60' },
  rosterPlayerName: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center' },
  saveLineBtn: { backgroundColor: '#27ae60', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveLineBtnWarning: { backgroundColor: '#95a5a6' },
  saveLineText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  pullModal: { width: '85%', backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', elevation: 10 },
  modalHeader: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#2c3e50' },
  pullGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  pullPlayerBtn: { backgroundColor: '#f0f0f0', padding: 12, margin: 6, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  pullPlayerName: { fontWeight: 'bold', color: '#34495e' },
  outcomeBtn: { width: '100%', backgroundColor: '#27ae60', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  obBtn: { backgroundColor: '#e74c3c' },
  outcomeText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  ratioContainer: { backgroundColor: '#fff', padding: 15, marginHorizontal: 10, marginBottom: 10, borderRadius: 12, elevation: 2, alignItems: 'center' },
  targetRatioBtn: { backgroundColor: '#eafaf1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginBottom: 10 },
  ratioLabel: { fontSize: 16, color: '#2c3e50' },
  countsContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  countText: { fontWeight: 'bold', fontSize: 18 },
  genderIconBadge: { position: 'absolute', top: 6, right: 6 }
});