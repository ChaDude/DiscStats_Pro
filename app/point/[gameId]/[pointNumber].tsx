import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Modal } from 'react-native';
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

export default function PointTrackingScreen() {
  const { gameId, pointNumber } = useLocalSearchParams<{ gameId: string; pointNumber: string }>();
  const router = useRouter();
  const pNum = parseInt(pointNumber, 10);

  const [game, setGame] = useState<Game | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [line, setLine] = useState<LinePlayer[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  
  const [ourScore, setOurScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [startOurScore, setStartOurScore] = useState(0); 
  const [startOpponentScore, setStartOpponentScore] = useState(0);

  const [possession, setPossession] = useState<'our' | 'opponent'>('our');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  
  const [lineModalVisible, setLineModalVisible] = useState(false);
  const [pullModalVisible, setPullModalVisible] = useState(false);
  const [pullStep, setPullStep] = useState<'who' | 'outcome'>('who');
  const [pullerId, setPullerId] = useState<number | null>(null);

  const [targetRatio, setTargetRatio] = useState<{m: number, f: number}>({m: 4, f: 3});
  const [ratioLocked, setRatioLocked] = useState(false); 

  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const getDisplayName = (player: Player, short: boolean) => {
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

      const teamSize = gameResult?.teamSize || 7;
      let defaultM = Math.ceil(teamSize / 2);
      let defaultF = Math.floor(teamSize / 2);
      let isLocked = false;

      if (gameResult?.genderRule === 'abba') {
         if (pNum === 1) {
             isLocked = false;
         } else {
             isLocked = true;
             const p1 = await db.getFirstAsync<{ genderRatio: string }>('SELECT genderRatio FROM points WHERE gameId = ? AND pointNumber = 1', [gameId]);
             
             const p1Str = p1?.genderRatio || `${defaultM}m${defaultF}f`;
             const mMatch = p1Str.match(/(\d+)m/);
             const p1M = mMatch ? parseInt(mMatch[1]) : defaultM;
             
             const cycle = Math.floor((pNum - 2) / 2) % 2; 
             const isSwap = cycle === 0; 
             
             const p1MaleHeavy = p1M > (teamSize / 2);
             
             if (isSwap) {
                 defaultM = p1MaleHeavy ? Math.floor(teamSize / 2) : Math.ceil(teamSize / 2);
                 defaultF = teamSize - defaultM;
             } else {
                 defaultM = p1MaleHeavy ? Math.ceil(teamSize / 2) : Math.floor(teamSize / 2);
                 defaultF = teamSize - defaultM;
             }
         }
         setTargetRatio({ m: defaultM, f: defaultF });
         setRatioLocked(isLocked);
      }

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
             const convertedLine: LinePlayer[] = rawLine.map((id: number) => ({ id, role: 'male' })); 
             setLine(convertedLine);
          } else {
             setLine(rawLine);
          }
        }
        
        if (gameResult?.genderRule === 'abba' && pointResult.genderRatio) {
            const mMatch = pointResult.genderRatio.match(/(\d+)m/);
            const fMatch = pointResult.genderRatio.match(/(\d+)f/);
            if (mMatch && fMatch) {
                setTargetRatio({ m: parseInt(mMatch[1]), f: parseInt(fMatch[1]) });
            }
        }

        if (eventsResult.length > 0) {
            const last = eventsResult[eventsResult.length - 1];
            if (['pull', 'pull_ob', 'throwaway', 'drop', 'd'].includes(last.eventType)) {
                if (last.eventType === 'd') setPossession('our');
                else setPossession('opponent');
            } else if (last.eventType === 'goal') {
                setPossession('opponent'); 
            }
        } else {
            setPossession(pointResult.startingOLine ? 'our' : 'opponent');
        }
      } else {
        const startOnO = !weArePulling;
        setPossession(startOnO ? 'our' : 'opponent');
        setLineModalVisible(true);
      }

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load point.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [gameId, pointNumber]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [events]);

  useEffect(() => {
    if (!loading && !lineModalVisible && events.length === 0 && line.length > 0) {
        if (possession === 'opponent') {
            setPullStep('who');
            setPullModalVisible(true);
        }
    }
  }, [loading, lineModalVisible, events, line, possession]);


  const cycleTargetRatio = () => {
      if (ratioLocked || game?.genderRule !== 'abba') {
          return;
      }

      const size = game?.teamSize || 7;
      let newM = targetRatio.m;
      let newF = targetRatio.f;
      
      if (size === 7) {
          if (newM === 4) { newM = 3; newF = 4; }
          else { newM = 4; newF = 3; }
      } else if (size === 6) {
          if (newM === 3) { newM = 4; newF = 2; }
          else if (newM === 4) { newM = 2; newF = 4; }
          else { newM = 3; newF = 3; }
      } else if (size === 5) {
          if (newM === 3) { newM = 2; newF = 3; }
          else { newM = 3; newF = 2; }
      }

      setTargetRatio({ m: newM, f: newF });
  };

  const saveLine = async (newLine: LinePlayer[]) => {
    const issues: string[] = [];
    const teamSize = game?.teamSize || 7;

    // 1. Check Count
    if (newLine.length !== teamSize) {
        issues.push(`• Player Count: ${newLine.length}/${teamSize}`);
    }

    // 2. Check Ratio (Only strict for ABBA)
    if (game?.genderRule === 'abba') {
        let m = 0, f = 0;
        newLine.forEach(lp => lp.role === 'male' ? m++ : f++);
        
        if (m !== targetRatio.m || f !== targetRatio.f) {
            issues.push(`• Gender Ratio: ${m}M/${f}F (Target: ${targetRatio.m}M/${targetRatio.f}F)`);
        }
    }

    if (issues.length > 0) {
        Alert.alert(
            'Line Issues',
            `The following checks failed:\n\n${issues.join('\n')}\n\nSave anyway?`,
            [
                { text: 'Fix Line', style: 'cancel' },
                { text: 'Save Anyway', style: 'destructive', onPress: () => persistLine(newLine) }
            ]
        );
        return;
    }

    await persistLine(newLine);
  };

  const persistLine = async (newLine: LinePlayer[]) => {
    const db = await getDB();
    const pointRow = await db.getFirstAsync('SELECT id FROM points WHERE gameId = ? AND pointNumber = ?', [gameId, pointNumber]);
    
    let m = 0, f = 0;
    newLine.forEach(lp => lp.role === 'male' ? m++ : f++);
    const calculatedRatio = `${m}m${f}f`;

    if (!pointRow) {
      await db.runAsync(
        'INSERT INTO points (gameId, pointNumber, ourScoreAfter, opponentScoreAfter, startingOLine, linePlayers, genderRatio) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [gameId, pointNumber, startOurScore, startOpponentScore, possession === 'our', JSON.stringify(newLine), calculatedRatio]
      );
    } else {
      await db.runAsync(
        'UPDATE points SET linePlayers = ?, genderRatio = ? WHERE gameId = ? AND pointNumber = ?',
        [JSON.stringify(newLine), calculatedRatio, gameId, pointNumber]
      );
    }
    setLine(newLine);
    setLineModalVisible(false);
  };

  const handlePullSelection = (playerId: number) => { setPullerId(playerId); setPullStep('outcome'); };
  
  const recordPull = async (outcome: 'good' | 'ob') => {
    try {
        const db = await getDB();
        const pointResult = await db.getFirstAsync<{ id: number }>('SELECT id FROM points WHERE gameId = ? AND pointNumber = ?', [gameId, pointNumber]);
        if (!pointResult) return; 
        
        const eventType = outcome === 'ob' ? 'pull_ob' : 'pull';
        await db.runAsync('INSERT INTO events (pointId, eventType, throwerId, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', [pointResult.id, eventType, pullerId]);
        setPullModalVisible(false); await loadData(); 
    } catch (e) { Alert.alert("Error", "Failed to record pull"); }
  };

  const recordOpponentScore = async () => {
      Alert.alert("Opponent Score", "Did the opponent score?", [
          { text: "Cancel", style: "cancel" },
          { text: "Confirm", onPress: async () => {
                const db = await getDB();
                const pointResult = await db.getFirstAsync<{ id: number }>('SELECT id FROM points WHERE gameId = ? AND pointNumber = ?', [gameId, pointNumber]);
                if (!pointResult) return;
                const newOppScore = opponentScore + 1;
                await db.runAsync('UPDATE points SET ourScoreAfter = ?, opponentScoreAfter = ? WHERE id = ?', [ourScore, newOppScore, pointResult.id]);
                await db.runAsync('INSERT INTO events (pointId, eventType, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP)', [pointResult.id, 'opponent_goal']);
                router.back();
          }}
      ]);
  };
  
  const togglePlayerInLine = (player: Player) => {
    const existingIndex = line.findIndex(lp => lp.id === player.id);

    if (existingIndex >= 0) {
        const newLine = [...line];
        newLine.splice(existingIndex, 1);
        setLine(newLine);
    } else {
        if (line.length >= (game?.teamSize || 7)) {
            Alert.alert('Line Full', `Maximum ${game?.teamSize || 7} players allowed.`);
            return;
        }

        if (player.gender === 'other') {
            Alert.alert(
                'Select Matchup Role',
                `Is ${player.firstName} playing as MMP or FMP this point?`,
                [
                    { text: 'MMP (Male)', onPress: () => setLine([...line, { id: player.id, role: 'male' }]) },
                    { text: 'FMP (Female)', onPress: () => setLine([...line, { id: player.id, role: 'female' }]) },
                    { text: 'Cancel', style: 'cancel' }
                ]
            );
        } else {
            setLine([...line, { id: player.id, role: player.gender as 'male' | 'female' }]);
        }
    }
  };

  const recordEvent = async (eventType: string) => {
    if (eventType === 'opponent_score') { recordOpponentScore(); return; }
    if (!selectedPlayerId) { Alert.alert('Select Player', 'Tap a player button first.'); return; }
    
    const inLine = line.some(lp => lp.id === selectedPlayerId);
    if (!inLine) { Alert.alert('Not on Field', 'Selected player is not in the current line.'); return; }

    try {
      const db = await getDB();
      const pointResult = await db.getFirstAsync<{ id: number }>('SELECT id FROM points WHERE gameId = ? AND pointNumber = ?', [gameId, pointNumber]);
      if (!pointResult) return;

      let throwerId = null, receiverId = null, defenderId = null;
      
      if (eventType === 'goal' || eventType === 'callahan') {
        let newOurScore = ourScore;
        if (eventType === 'goal') { receiverId = selectedPlayerId; newOurScore++; }
        else { defenderId = selectedPlayerId; receiverId = selectedPlayerId; newOurScore++; }

        await db.runAsync('INSERT INTO events (pointId, eventType, throwerId, receiverId, defenderId, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)', [pointResult.id, eventType, throwerId, receiverId, defenderId]);
        await db.runAsync('UPDATE points SET ourScoreAfter = ?, opponentScoreAfter = ? WHERE id = ?', [newOurScore, opponentScore, pointResult.id]);
        Alert.alert("Point Finished!", `Score: ${newOurScore} - ${opponentScore}`, [{ text: "Next Point", onPress: () => router.back() }]);
        return;
      }

      switch (eventType) {
        case 'throwaway':
        case 'drop':
          throwerId = selectedPlayerId;
          setPossession(possession === 'our' ? 'opponent' : 'our');
          break;
        case 'd':
          defenderId = selectedPlayerId;
          setPossession(possession === 'our' ? 'opponent' : 'our');
          break;
      }

      await db.runAsync('INSERT INTO events (pointId, eventType, throwerId, receiverId, defenderId, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)', [pointResult.id, eventType, throwerId, receiverId, defenderId]);
      setSelectedPlayerId(null);
      await loadData(); 
    } catch (error) { console.error(error); Alert.alert('Error', 'Failed to record event.'); }
  };

  const undoLastEvent = async () => {
    if (events.length === 0) return;
    Alert.alert('Undo', 'Remove last event?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Undo', style: 'destructive', onPress: async () => {
            const db = await getDB();
            const lastEvent = events[events.length - 1];
            await db.runAsync('DELETE FROM events WHERE id = ?', [lastEvent.id]);
            await loadData();
        }},
    ]);
  };

  const currentPossession = possession === 'our' ? game?.teamName : game?.opponentName;
  const currentCounts = useMemo(() => getLineCounts(), [line]);
  const isABBA = game?.genderRule === 'abba';

  // VALIDATION STATE
  const isLineFull = line.length === (game?.teamSize || 7);
  const isRatioCorrect = !isABBA || (currentCounts.m === targetRatio.m && currentCounts.f === targetRatio.f);
  const isLineValid = isLineFull && isRatioCorrect;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `Point ${pointNumber}` }} />

      <View style={styles.header}>
        <Text style={styles.pointTitle} numberOfLines={1} adjustsFontSizeToFit>Point {pointNumber}</Text>
        <Text style={styles.scoreText} numberOfLines={1} adjustsFontSizeToFit>{game?.teamName} {ourScore} - {opponentScore} {game?.opponentName}</Text>
        <Text style={styles.possessionText} numberOfLines={1} adjustsFontSizeToFit>{currentPossession} has the disc</Text>
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
            
            return (
              <TouchableOpacity
                key={linePlayer.id}
                style={[styles.linePlayerButton, selectedPlayerId === linePlayer.id && styles.linePlayerSelected]}
                onPress={() => setSelectedPlayerId(selectedPlayerId === linePlayer.id ? null : linePlayer.id)}
              >
                <Text style={styles.linePlayerName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {getDisplayName(player, true)}
                </Text>
                {player.number != null && (
                  <Text style={styles.linePlayerNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    #{player.number}
                  </Text>
                )}
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
          {possession === 'our' ? (
             <>
               <TouchableOpacity style={styles.eventBtn} onPress={() => recordEvent('goal')}>
                 <FontAwesome name="flag-checkered" size={32} color="#fff" />
                 <Text style={styles.eventText}>Goal</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.eventBtn} onPress={() => recordEvent('throwaway')}>
                 <FontAwesome name="exclamation-triangle" size={32} color="#fff" />
                 <Text style={styles.eventText}>Turn</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.eventBtn} onPress={() => recordEvent('drop')}>
                 <FontAwesome name="arrow-down" size={32} color="#fff" />
                 <Text style={styles.eventText}>Drop</Text>
               </TouchableOpacity>
             </>
          ) : (
             <>
               <TouchableOpacity style={styles.eventBtn} onPress={() => recordEvent('d')}>
                 <FontAwesome name="shield" size={32} color="#fff" />
                 <Text style={styles.eventText}>D</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.eventBtn} onPress={() => recordEvent('callahan')}>
                 <FontAwesome name="star" size={32} color="#fff" />
                 <Text style={styles.eventText}>Callahan</Text>
               </TouchableOpacity>
               <TouchableOpacity style={[styles.eventBtn, { backgroundColor: '#e67e22' }]} onPress={() => recordEvent('opponent_score')}>
                 <FontAwesome name="times-circle" size={32} color="#fff" />
                 <Text style={styles.eventText}>Opp Goal</Text>
               </TouchableOpacity>
             </>
          )}

          <TouchableOpacity style={[styles.eventBtn, styles.undoBtn]} onPress={undoLastEvent}>
            <FontAwesome name="undo" size={32} color="#fff" />
            <Text style={styles.eventText}>Undo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.eventsSection}>
        <Text style={styles.eventsTitle}>Events ({events.length})</Text>
        <ScrollView ref={scrollRef} style={styles.eventsScroll}>
          {events.length === 0 ? (
             <Text style={styles.emptyEvents}>
               {possession === 'our' ? "Ready for Offense" : "Waiting for Pull..."}
             </Text>
          ) : (
            events.map((event, index) => {
              const thrower = roster.find(p => p.id === event.throwerId);
              let desc = event.eventType.toUpperCase();
              if (thrower) desc += ` (${getDisplayName(thrower, false)})`;
              if (event.eventType === 'pull') desc = `PULL by ${thrower ? getDisplayName(thrower, false) : 'Us'} (Good)`;
              if (event.eventType === 'pull_ob') desc = `PULL OB by ${thrower ? getDisplayName(thrower, false) : 'Us'}`;
              
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
                      <Text style={[styles.countText, {
                          color: isABBA ? (currentCounts.m === targetRatio.m ? '#3498db' : '#e74c3c') : '#3498db'
                      }]}>
                         {isABBA ? `Selected: ${currentCounts.m}M` : `${currentCounts.m} Men`}
                      </Text>
                      <Text style={[styles.countText, {
                          color: isABBA ? (currentCounts.f === targetRatio.f ? '#e91e63' : '#e74c3c') : '#e91e63'
                      }]}>
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
                                   <TouchableOpacity key={lp.id} style={styles.pullPlayerBtn} onPress={() => handlePullSelection(lp.id)}>
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
  linePlayerSelected: { backgroundColor: '#27ae60' },
  linePlayerName: { fontSize: 14, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center' },
  linePlayerNumber: { fontSize: 12, color: '#7f8c8d', marginTop: 4 },
  linePlayerEmpty: { width: '23%', aspectRatio: 1, margin: '1%' },
  roleBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 4, borderRadius: 4 },
  roleText: { fontSize: 10, fontWeight: 'bold', color: '#333' },
  eventGridSection: { flex: 0.37, justifyContent: 'center', backgroundColor: '#f8f9fa' },
  eventGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 10 },
  eventBtn: { backgroundColor: '#27ae60', width: 90, height: 90, borderRadius: 16, justifyContent: 'center', alignItems: 'center', margin: 6, elevation: 4 },
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