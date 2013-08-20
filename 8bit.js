/**
 * 8Bit.js Audio Library - Write music using 8bit oscillation sounds.
 * Supports rhythms and multiple instruments.
 *
 * @author Cody Lundquist - 2013
 */
var EightBit = (function() {
    var
        // Notes and their BPM numerator
        notes = {
            whole: 1,
            dottedHalf: 0.75,
            half: 0.5,
            dottedQuarter: 0.375,
            quarter: 0.25,
            dottedEighth: 0.1875,
            tripletQuarter: 0.166666667,
            eighth: 0.125,
            dottedSixteenth: 0.09375,
            tripletEighth: 0.083333333,
            sixteenth: 0.0625,
            tripletSixteenth: 0.041666667,
            thirtySecond: 0.03125
        },
        // Pitch frequencies with corresponding names
        pitches = {'C3': 130.81,'C#3': 138.59,'Db3': 138.59,'D3': 146.83,'D#3': 155.56,'Eb3': 155.56,'E3': 164.81,'F3': 174.61,'F#3': 185.00,'Gb3': 185.00,'G3': 196.00,'G#3': 207.65,'Ab3': 207.65,'A3': 220.00,'A#3': 233.08,'Bb3': 233.08,'B3': 246.94,'C4': 261.63,'C#4': 277.18,'Db4': 277.18,'D4': 293.66,'D#4': 311.13,'Eb4': 311.13,'E4': 329.63,'F4': 349.23,'F#4': 369.99,'Gb4': 369.99,'G4': 392.00,'G#4': 415.30,'Ab4': 415.30,'A4': 440.00,'A#4': 466.16,'Bb4': 466.16,'B4': 493.88,'C5': 523.25,'C#5': 554.37,'Db5': 554.37,'D5': 587.33,'D#5': 622.25,'Eb5': 622.25,'E5': 659.26,'F5': 698.46,'F#5': 739.99,'Gb5': 739.99,'G5': 783.99,'G#5': 830.61,'Ab5': 830.61,'A5': 880.00,'A#5': 932.33,'Bb5': 932.33,'B5': 987.77,'C6': 1046.50,'C#6': 1108.73,'Db6': 1108.73,'D6': 1174.66,'D#6': 1244.51,'Eb6': 1244.51,'E6': 1318.51,'F6': 1396.91,'F#6': 1479.98,'Gb6': 1479.98,'G6': 1567.98,'G#6': 1661.22,'Ab6': 1661.22,'A6': 1760.00,'A#6': 1864.66,'Bb6': 1864.66,'B6': 1975.53,'C7': 2093.00,'C#7': 2217.46,'Db7': 2217.46,'D7': 2349.32,'D#7': 2489.02,'Eb7': 2489.02,'E7': 2637.02,'F7': 2793.83,'F#7': 2959.96,'Gb7': 2959.96,'G7': 3135.96,'G#7': 3322.44,'Ab7': 3322.44,'A7': 3520.00,'A#7': 3729.31,'Bb7': 3729.31,'B7': 3951.07,'C8': 4186.01},
        // Used when parsing the time signature
        signatureToNote = {
            2: 6,
            4: 3,
            8: 4.50
        },
        // Different waveforms that are supported
        waveforms = {
            'sine': 0,
            'square': 1,
            'sawtooth': 2,
            'triangle': 3
        }
    ;

    /**
     * Constructor
     */
    function cls() {
        var self = this,
            ac = new (window.AudioContext || window.webkitAudioContext),
            muteGain = ac.createGain(),
            masterVolume = ac.createGain(),
            beatsPerBar,
            noteGetsBeat,
            tempo,
            allNotesBuffer = [],
            oscillators = [],
            currentPlayTime,
            totalPlayTime = 0,
                /**
                 * Instrument Class
                 */
                Instrument = (function() {
                /**
                 * Constructor
                 * @param [waveform]
                 */
                function cls(waveform) {
                    if (waveform) {
                        if (typeof waveforms[waveform] === 'undefined') {
                            throw new Error(waveform + ' is not a valid Waveform.');
                        }
                    } else {
                        waveform = 'sine';
                    }

                    var self = this,
                        currentTime = 0,
                        lastRepeatCount = 0,
                        volumeLevel = 0.25,
                        pitchType = waveforms[waveform],
                        notesBuffer = []
                        ;

                    this.setVolume = function(newVolumeLevel) {
                        volumeLevel = newVolumeLevel;
                    };

                    /**
                     * Add a note to an instrument
                     * @param pitch - Comma separated string if more than one note
                     * @param note
                     * @param [tie]
                     */
                    this.addNote = function(pitch, note, tie) {
                        if (typeof notes[note] === 'undefined') {
                            throw new Error(note + ' is not a correct note.');
                        }

                        var duration = getDuration(note),
                            articulationGap = tie ? 0 : duration * 0.1;

                        var checkPitches = pitch.split(',');

                        checkPitches.forEach(function(p) {
                            p = p.trim();
                            if (typeof pitches[p] === 'undefined') {
                                throw new Error(p + ' is not a valid pitch.');
                            }
                        });

                        notesBuffer.push({
                            volume: volumeLevel,
                            pitch: pitch,
                            pitchType: pitchType,
                            duration: duration,
                            articulationGap: articulationGap,
                            startTime: currentTime,
                            stopTime: currentTime + duration - articulationGap
                        });

                        currentTime += duration;
                    };

                    /**
                     * Add a rest to an instrument
                     *
                     * @param note
                     */
                    this.addRest = function(note) {
                        if (typeof notes[note] === 'undefined') {
                            throw new Error('Need to use correct note.');
                        }

                        var duration = getDuration(note);

                        notesBuffer.push({
                            volume: volumeLevel,
                            pitch: false,
                            pitchType: 0,
                            duration: duration,
                            articulationGap: 0,
                            startTime: currentTime,
                            stopTime: currentTime + duration
                        });

                        currentTime += duration;
                    };

                    /**
                     * Place where a repeat section should start
                     */
                    this.repeatStart = function() {
                        lastRepeatCount = notesBuffer.length;
                    };

                    /**
                     * Repeat from beginning
                     */
                    this.repeatFromBeginning = function(numOfRepeats) {
                        lastRepeatCount = 0;
                        self.repeat(numOfRepeats);
                    };

                    /**
                     * Number of times the section should repeat
                     * @param [numOfRepeats] - defaults to 1
                     */
                    this.repeat = function(numOfRepeats) {
                        numOfRepeats = typeof numOfRepeats === 'undefined' ? 1 : numOfRepeats;
                        for (var r = 0; r < numOfRepeats; r++) {
                            var copyNotesBuffer = notesBuffer.slice(lastRepeatCount);
                            lastRepeatCount = copyNotesBuffer.length;
                            for (var i = 0; i < copyNotesBuffer.length; i++) {
                                var noteCopy = clone(copyNotesBuffer[i]);

                                noteCopy.startTime = currentTime;
                                noteCopy.stopTime = currentTime + noteCopy.duration - noteCopy.articulationGap;

                                copyNotesBuffer[i] = noteCopy;
                                currentTime += noteCopy.duration;
                            }


                            notesBuffer = notesBuffer.concat(copyNotesBuffer);
                        }
                    };

                    /**
                     * Copies all notes to the master list of notes.
                     */
                    this.finish = function() {
                        allNotesBuffer = allNotesBuffer.concat(notesBuffer);
                    };
                }

                return cls;
            })()
        ;

        // Setup mute gain and connect to the context
        muteGain.gain.value = 0;
        muteGain.connect(ac.destination);

        // Setup master volume and connect to the context
        masterVolume.gain.value = 1;
        masterVolume.connect(ac.destination);

        /**
         * Create a new instrument
         *
         * @param [waveform] - defaults to sine
         * @returns {Instrument}
         */
        this.createInstrument = function(waveform) {
            return new Instrument(waveform);
        };

        /**
         * Stop playing all music and reset the Oscillators
         */
        this.stop = function(fadeOut) {
            totalPlayTime = 0;
            if (typeof fadeOut === 'undefined') {
                fadeOut = true;
            }
            if (fadeOut) {
                fade('down', function() {
                    reset();
                    self.unmute();
                });
            } else {
                reset();
            }
        };

        /**
         * Mute all of the music
         */
        this.mute = function(cb) {
            fade('down', cb);
        };

        /**
         * Unmute all of the music
         */
        this.unmute = function(cb) {
            fade('up', cb);
        };

        /**
         * Create all the oscillators;
         */
        this.end = function() {
            oscillators = [];
            for (var i = 0; i < allNotesBuffer.length; i++) {
                var pitch = allNotesBuffer[i].pitch;

                if (! pitch) {
                    pitch = '0';
                }

                pitch.split(',').forEach(function(p) {
                    p = p.trim();
                    var o = ac.createOscillator(),
                        volume = ac.createGain();

                    // Connect volume gain to the context;
                    volume.connect(masterVolume);

                    if (p === false) {
                        o.connect(muteGain);
                    } else {
                        // Set the volume for this note
                        volume.gain.value = allNotesBuffer[i].volume;
                        o.connect(volume);
                    }

                    o.type = allNotesBuffer[i].pitchType;
                    o.frequency.value = p !== '0' ? pitches[p] : 0;

                    oscillators.push({
                        startTime: allNotesBuffer[i].startTime,
                        stopTime: allNotesBuffer[i].stopTime,
                        o: o,
                        volume: volume
                    });
                });
            }
        };


        /**
         * Sets the time signature for the music. Just like in notation 4/4 time would be setTimeSignature(4, 4);
         * @param top - Number of beats per bar
         * @param bottom - What note type has the beat
         */
        this.setTimeSignature = function(top, bottom) {
            if (typeof signatureToNote[bottom] === 'undefined') {
                throw new Error('The bottom time signature is not supported.');
            }

            beatsPerBar = top;
            noteGetsBeat = signatureToNote[bottom];
        };

        /**
         * Sets the tempo
         *
         * @param t
         */
        this.setTempo = function(t) {
            tempo = 60 / t;
        };

        /**
         * Grabs all the oscillator notes and plays them
         * It will use the total time played so far as an offset so you pause/play the music
         */
        this.play = function() {
            currentPlayTime = ac.currentTime;

            var timeOffset = ac.currentTime - totalPlayTime;
            for (var i = 0; oscillators.length > i; i++) {
                var o = oscillators[i].o,
                    startTime = oscillators[i].startTime,
                    stopTime = oscillators[i].stopTime
                ;
                o.start(startTime + timeOffset);
                o.stop(stopTime + timeOffset);
            }

            if (totalPlayTime > 0) {
                fade('up');
            }
        };

        /**
         * Pauses the music, resets the oscillators, gets the total time played so far
         */
        this.pause = function() {
            totalPlayTime += ac.currentTime - currentPlayTime;
            fade('down', function() {
                reset();
            });
        };

        // Default to 120 tempo
        this.setTempo(120);

        // Default to 4/4 time signature
        this.setTimeSignature(4, 4);

        /**
         * Helper function to figure out how long a note is
         *
         * @param note
         * @returns {number}
         */
        function getDuration(note) {
            return notes[note] * tempo / noteGetsBeat * 10;
        }

        /**
         * Helper function to stop all oscillators and recreate them
         */
        function reset() {
            oscillators.forEach(function(osc) {
                osc.o.stop(0);
            });
            self.end();
        }

        /**
         * Helper function to fade up/down master volume
         *
         * @param direction - up or down
         * @param [cb] - Callback function fired after the transition is completed
         */
        function fade(direction, cb) {
            if ('up' !== direction && 'down' !== direction) {
                throw new Error('Direction must be either up or down.');
            }
            var i = 100,
                timeout = function() {
                    setTimeout(function() {
                        if (i > 0) {
                            i = i - 2;
                            var gain = 'up' === direction ? 100 - i : i;
                            masterVolume.gain.value = gain / 100;
                            timeout();
                        } else {
                            if (typeof cb === 'function') {
                                cb();
                            }
                        }
                    }, 1);
                };

            timeout();
        }
    }

    /**
     * Helper function to clone an object
     *
     * @param obj
     * @returns {copy}
     */
    function clone(obj) {
        if (null == obj || "object" != typeof obj) return obj;
        var copy = obj.constructor();
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
        }

        return copy;
    }

    return cls;
})();