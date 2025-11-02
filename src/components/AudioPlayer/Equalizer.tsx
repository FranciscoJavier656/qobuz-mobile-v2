import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import Icon from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Definición de frecuencias del ecualizador (10 bandas)
const FREQUENCIES = [
  { freq: 32, label: '32Hz' },
  { freq: 55, label: '55Hz' },    // ⭐ Frecuencia para Bass Boost
  { freq: 125, label: '125Hz' },
  { freq: 250, label: '250Hz' },
  { freq: 500, label: '500Hz' },
  { freq: 1000, label: '1kHz' },
  { freq: 2000, label: '2kHz' },
  { freq: 4000, label: '4kHz' },
  { freq: 8000, label: '8kHz' },
  { freq: 16000, label: '16kHz' },
];

// Presets profesionales
const PRESETS = {
  flat: {
    name: 'Flat',
    icon: 'horizontal-rule',
    values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  bassBoost: {
    name: 'Bass Boost',
    icon: 'graphic-eq',
    values: [15, 20, 15, 10, 5, 0, 0, 0, 0, 0], // +20dB @ 55Hz
  },
  rock: {
    name: 'Rock',
    icon: 'music-note',
    values: [8, 5, -5, -8, -3, 4, 8, 11, 11, 11],
  },
  electronic: {
    name: 'Electronic',
    icon: 'flash-on',
    values: [8, 6, 0, -5, -4, 0, 8, 9, 9, 8],
  },
  jazz: {
    name: 'Jazz',
    icon: 'album',
    values: [4, 3, 0, 2, -2, -2, 0, 2, 3, 4],
  },
  classical: {
    name: 'Classical',
    icon: 'library-music',
    values: [5, 4, 3, 2, -2, -2, 0, 2, 3, 4],
  },
  hiphop: {
    name: 'Hip-Hop',
    icon: 'headset',
    values: [12, 10, 3, 1, -2, -1, 1, -1, 2, 3],
  },
  vocal: {
    name: 'Vocal',
    icon: 'mic',
    values: [-2, -3, -3, 1, 3, 3, 4, 3, 0, -2],
  },
};

interface EqualizerProps {
  visible: boolean;
  onClose: () => void;
}

const Equalizer: React.FC<EqualizerProps> = ({ visible, onClose }) => {
  const [eqValues, setEqValues] = useState<number[]>(PRESETS.flat.values);
  const [selectedPreset, setSelectedPreset] = useState<string>('flat');
  
  // Animaciones para efecto "genie" REAL estilo macOS - mucho más dramático
  const [scaleYAnim] = useState(new Animated.Value(0.01)); // Casi invisible al inicio
  const [scaleXAnim] = useState(new Animated.Value(0.05)); // Muy pequeño horizontalmente
  const [translateYAnim] = useState(new Animated.Value(SCREEN_HEIGHT * 0.5)); // Desde la mitad inferior
  const [opacityAnim] = useState(new Animated.Value(0));
  const [skewYAnim] = useState(new Animated.Value(0)); // Para distorsión
  const [widthAnim] = useState(new Animated.Value(0)); // Expansión de ancho
  
  // Animación en múltiples fases como macOS
  const [phase1] = useState(new Animated.Value(0)); // Fase inicial de expansión
  const [phase2] = useState(new Animated.Value(0)); // Fase de estiramiento
  const [phase3] = useState(new Animated.Value(0)); // Fase de rebote

  useEffect(() => {
    if (visible) {
      console.log('[Equalizer] 🎭 Iniciando animación GENIE');
      
      // Resetear valores
      scaleYAnim.setValue(0.01);
      scaleXAnim.setValue(0.05);
      translateYAnim.setValue(SCREEN_HEIGHT * 0.5);
      opacityAnim.setValue(0);
      phase1.setValue(0);
      phase2.setValue(0);
      phase3.setValue(0);
      
      // Cargar valores guardados
      loadEqSettings();
      
      // EFECTO GENIE REAL - Animación en 3 fases secuenciales
      Animated.sequence([
        // FASE 1: Aparición y expansión vertical dramática (0-200ms)
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(phase1, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(scaleYAnim, {
            toValue: 0.6, // Se estira verticalmente primero
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }),
          Animated.timing(scaleXAnim, {
            toValue: 0.3, // Sigue estrecho
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateYAnim, {
            toValue: SCREEN_HEIGHT * 0.3,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        
        // FASE 2: Expansión horizontal con distorsión (200-400ms)
        Animated.parallel([
          Animated.spring(scaleXAnim, {
            toValue: 1.1, // Expansión horizontal dramática con overshoot
            tension: 80,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.spring(scaleYAnim, {
            toValue: 0.95, // Se comprime un poco verticalmente
            tension: 90,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(phase2, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(translateYAnim, {
            toValue: 0,
            tension: 70,
            friction: 8,
            useNativeDriver: true,
          }),
        ]),
        
        // FASE 3: Rebote final y ajuste (400-550ms)
        Animated.parallel([
          Animated.spring(scaleXAnim, {
            toValue: 1, // Vuelve al tamaño normal
            tension: 100,
            friction: 9,
            useNativeDriver: true,
          }),
          Animated.spring(scaleYAnim, {
            toValue: 1, // Tamaño normal
            tension: 100,
            friction: 9,
            useNativeDriver: true,
          }),
          Animated.timing(phase3, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        console.log('[Equalizer] ✅ Animación GENIE completada');
      });
      
    } else {
      console.log('[Equalizer] 🎭 Cerrando con animación inversa');
      
      // CIERRE: Efecto inverso - se contrae hacia el botón
      Animated.parallel([
        Animated.timing(scaleYAnim, {
          toValue: 0.01,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleXAnim, {
          toValue: 0.05,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: SCREEN_HEIGHT * 0.6,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(phase1, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(phase2, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(phase3, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        console.log('[Equalizer] ✅ Cierre completado');
      });
    }
  }, [visible]);

  const loadEqSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('@eq_settings');
      if (saved) {
        const { values, preset } = JSON.parse(saved);
        setEqValues(values);
        setSelectedPreset(preset);
      }
    } catch (error) {
      console.log('[Equalizer] Error cargando ajustes:', error);
    }
  };

  const saveEqSettings = async (values: number[], preset: string) => {
    try {
      await AsyncStorage.setItem('@eq_settings', JSON.stringify({ values, preset }));
      console.log('[Equalizer] ✅ Ajustes guardados');
    } catch (error) {
      console.log('[Equalizer] Error guardando ajustes:', error);
    }
  };

  const handlePresetChange = (presetKey: string) => {
    const preset = PRESETS[presetKey as keyof typeof PRESETS];
    setEqValues([...preset.values]);
    setSelectedPreset(presetKey);
    saveEqSettings(preset.values, presetKey);
  };

  const handleSliderChange = (index: number, value: number) => {
    const newValues = [...eqValues];
    newValues[index] = value;
    setEqValues(newValues);
    setSelectedPreset('custom');
    saveEqSettings(newValues, 'custom');
  };

  const handleReset = () => {
    handlePresetChange('flat');
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop animado con blur */}
      <Animated.View 
        style={[
          styles.backdrop,
          {
            opacity: opacityAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
          }
        ]}
      >
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={onClose}
        />
      </Animated.View>

      {/* Contenedor principal con efecto "genie" DRAMÁTICO */}
      <Animated.View 
        style={[
          styles.container,
          {
            opacity: opacityAnim,
            transform: [
              // Traslación vertical - se mueve desde abajo
              {
                translateY: translateYAnim,
              },
              // Escala vertical - se estira dramáticamente
              {
                scaleY: scaleYAnim,
              },
              // Escala horizontal - expansión dramática con distorsión
              {
                scaleX: scaleXAnim,
              },
              // Perspectiva 3D pronunciada
              {
                perspective: 1500,
              },
              // Rotación en X para efecto de profundidad
              {
                rotateX: phase1.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['60deg', '20deg'], // Rotación pronunciada al inicio
                }),
              },
              // Rotación adicional que se va reduciendo
              {
                rotateX: phase2.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['20deg', '5deg'],
                }),
              },
              // Rotación final de ajuste
              {
                rotateX: phase3.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['5deg', '0deg'],
                }),
              },
            ],
          }
        ]}
      >
        <LinearGradient
          colors={['#0a0a0a', '#1a1a2e', '#16213e']}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
              <Icon name="restart-alt" size={24} color="#888" />
            </TouchableOpacity>
            
            <Text style={styles.title}>Ecualizador</Text>
            
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Presets */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.presetsContainer}
            contentContainerStyle={styles.presetsContent}
          >
            {Object.entries(PRESETS).map(([key, preset]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.presetButton,
                  selectedPreset === key && styles.presetButtonActive
                ]}
                onPress={() => handlePresetChange(key)}
              >
                <LinearGradient
                  colors={selectedPreset === key 
                    ? ['#e94560', '#e94560'] 
                    : ['#2a2a3e', '#1a1a2e']
                  }
                  style={styles.presetGradient}
                >
                  <Icon 
                    name={preset.icon as any} 
                    size={20} 
                    color={selectedPreset === key ? '#fff' : '#888'} 
                  />
                  <Text style={[
                    styles.presetText,
                    selectedPreset === key && styles.presetTextActive
                  ]}>
                    {preset.name}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Ecualizador visual */}
          <View style={styles.eqContainer}>
            <View style={styles.dbScale}>
              <Text style={styles.dbLabel}>+20</Text>
              <Text style={styles.dbLabel}>+10</Text>
              <Text style={styles.dbLabel}>0</Text>
              <Text style={styles.dbLabel}>-10</Text>
              <Text style={styles.dbLabel}>-20</Text>
            </View>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.slidersContainer}
            >
              {FREQUENCIES.map((band, index) => (
                <View key={band.freq} style={styles.sliderWrapper}>
                  {/* Barra visual de nivel */}
                  <View style={styles.visualBar}>
                    <View 
                      style={[
                        styles.visualBarFill,
                        {
                          height: `${((eqValues[index] + 20) / 40) * 100}%`,
                        }
                      ]}
                    >
                      <LinearGradient
                        colors={eqValues[index] > 10 
                          ? ['#e94560', '#ff6b6b'] 
                          : eqValues[index] > 0 
                            ? ['#00adb5', '#4ecdc4']
                            : ['#888', '#666']
                        }
                        style={styles.visualBarGradient}
                      />
                    </View>
                  </View>

                  {/* Slider */}
                  <Slider
                    style={styles.slider}
                    value={eqValues[index]}
                    minimumValue={-20}
                    maximumValue={20}
                    step={1}
                    onValueChange={(value) => handleSliderChange(index, value)}
                    minimumTrackTintColor="#e94560"
                    maximumTrackTintColor="#333"
                    thumbTintColor="#fff"
                    vertical
                  />

                  {/* Valor numérico */}
                  <Text style={styles.valueText}>
                    {eqValues[index] > 0 ? '+' : ''}{eqValues[index]}
                  </Text>

                  {/* Etiqueta de frecuencia */}
                  <Text style={styles.frequencyLabel}>
                    {band.label}
                  </Text>

                  {/* Indicador especial para 55Hz */}
                  {band.freq === 55 && eqValues[index] >= 15 && (
                    <View style={styles.bassBoostIndicator}>
                      <Icon name="graphic-eq" size={16} color="#e94560" />
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Footer info */}
          <View style={styles.footer}>
            <Icon name="info-outline" size={16} color="#888" />
            <Text style={styles.footerText}>
              {selectedPreset === 'bassBoost' 
                ? '🔊 Bass Boost activo: +20dB @ 55Hz' 
                : selectedPreset === 'custom'
                  ? 'Ajustes personalizados'
                  : `Preset: ${PRESETS[selectedPreset as keyof typeof PRESETS]?.name || 'Flat'}`
              }
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  resetButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetsContainer: {
    marginTop: 10,
    maxHeight: 80,
  },
  presetsContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  presetButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  presetButtonActive: {
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  presetGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  presetText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  presetTextActive: {
    color: '#fff',
  },
  eqContainer: {
    flex: 1,
    flexDirection: 'row',
    marginTop: 30,
    paddingHorizontal: 10,
  },
  dbScale: {
    width: 40,
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingRight: 10,
  },
  dbLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  slidersContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  sliderWrapper: {
    width: 60,
    alignItems: 'center',
    position: 'relative',
  },
  visualBar: {
    width: 30,
    height: 200,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 10,
    justifyContent: 'flex-end',
  },
  visualBarFill: {
    width: '100%',
    borderRadius: 15,
    overflow: 'hidden',
  },
  visualBarGradient: {
    width: '100%',
    height: '100%',
  },
  slider: {
    width: 200,
    height: 40,
    transform: [{ rotate: '-90deg' }],
    position: 'absolute',
    top: 80,
  },
  valueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    marginTop: 215,
    marginBottom: 8,
  },
  frequencyLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
  },
  bassBoostIndicator: {
    position: 'absolute',
    top: -10,
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
    borderRadius: 12,
    padding: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  footerText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
});

export default Equalizer;
