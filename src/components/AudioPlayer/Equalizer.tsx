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
  
  // Animaciones para efecto "genie" estilo macOS
  const [scaleAnim] = useState(new Animated.Value(0));
  const [translateYAnim] = useState(new Animated.Value(400));
  const [opacityAnim] = useState(new Animated.Value(0));
  const [rotateAnim] = useState(new Animated.Value(0));
  const [scaleXAnim] = useState(new Animated.Value(0.1)); // Para efecto de expansión horizontal

  useEffect(() => {
    if (visible) {
      // Cargar valores guardados
      loadEqSettings();
      
      // Efecto "genie" al abrir - parece que sale del botón y se expande
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.spring(scaleXAnim, {
          toValue: 1,
          tension: 70,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          tension: 65,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(rotateAnim, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Efecto "genie" al cerrar - parece que se contrae hacia el botón
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(scaleXAnim, {
          toValue: 0.1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 400,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
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

      {/* Contenedor principal con efecto "genie" */}
      <Animated.View 
        style={[
          styles.container,
          {
            opacity: opacityAnim,
            transform: [
              {
                translateY: translateYAnim,
              },
              {
                scaleY: scaleAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.2, 1.08, 1], // Efecto de "rebote" vertical al expandirse
                }),
              },
              {
                scaleX: scaleXAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.1, 1.05, 1], // Expansión horizontal dramática
                }),
              },
              {
                perspective: 1200,
              },
              {
                rotateX: rotateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['50deg', '0deg'], // Rotación 3D pronunciada para efecto "genie"
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
