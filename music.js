/*
  File: music.js
  Author: John Hamer <john.hamer@glasgow.ac.uk>
  Purpose:
    A set of "musical objects", for use with midi.js.
     * Par  represents parallel performance, such as a chord or several pieces played simultaneously;
     * Seq  represents sequential performance, such as a scale or several pieces placed consecutively;
     * Note represents a single note (a pitch and a duration);
     * Rest represents silence (a duration).

    Par and Seq are "combinators" - they combine other musical objects.
    For example,

      var c = new Par([new Note(60), new Note(64), new Note(67)]) ==> a chord
      var s = new Seq([new Note(60), new Note(62), new Note(64)]) ==> a scale
      var scsc = new Seq([s, c, s, c]) ==> sequence of the above
*/

function Note(pitch, dur) {
    this.pitch = pitch;
    this.dur = dur;
}

function Rest(dur) {
    this.dur = dur;
}

function Par(parts) {
    this.parts = parts;
}

function Seq(parts) {
    this.parts = parts;
}


// Perform converts a musical object into a sequence of note on/off
// events. These can then be time-ordered and formatted as a MIDI
// file.
Note.prototype.perform = function(start, events) {
    events.push({noteOn: true,  pitch: this.pitch, when: start});
    events.push({noteOn: false, pitch: this.pitch, when: start + this.dur});
    return start + this.dur;
}

Rest.prototype.perform = function(start, events) {
    return start + this.dur;
}

Par.prototype.perform = function(start, events) {
    var finish = start;
    for (var i = 0; i < this.parts.length; i++)
	finish = Math.max(finish, this.parts[i].perform(start, events));
    return finish;
}

Seq.prototype.perform = function(start, events) {
    var finish = start;
    for (var i = 0; i < this.parts.length; i++)
	finish = this.parts[i].perform(finish, events);
    return finish;
}

Note.prototype.toString = function() { return "Note(" + this.pitch + "," + this.dur + ")"; }
Rest.prototype.toString = function() { return "Rest(" + this.dur + ")"; }
Par.prototype.toString  = function() { return "Par("  + this.parts.join(", ") + ")"; }
Seq.prototype.toString  = function() { return "Seq("  + this.parts.join(", ") + ")"; }

function perform(music) {
    var notes = [];
    music.perform(0, notes);
    notes.sort(function(a, b) {
	var diff = a.when - b.when;
	if (diff == 0)
	    // Put noteOn before noteOff if both occur at the same time
	    return a.noteOn ? 1 : -1;
	return diff;
    });
    var now = 0;
    var events = [];
    for (var i = 0; i < notes.length; i++) {
	if (notes[i].noteOn)
	    events.push(MidiEvent.noteOn(notes[i].pitch, notes[i].when - now));
	else
	    events.push(MidiEvent.noteOff(notes[i].pitch, notes[i].when - now));
	now = notes[i].when;
    }

    return events;
}

function toMidi(music) {
    return MidiWriter({tracks: [new MidiTrack({events: perform(music)})]});
}

/*
    Musical objects can be transformed in interesting ways. For
    example, to change the tempo of a piece of music we can write a
    "tempo" function. There are four cases to consider - one for each
    musical object type:
*/

// For Note, tempo keeps the pitch the same, but scales its duration
Note.prototype.tempo = function(d) {
    return new Note(this.pitch, this.dur * d);
}
// For a Rest, we just scale the duration
Rest.prototype.tempo = function(d) {
    return new Rest(this.dur * d);
}
// For Par and Seq, transform each parts and re-assemble
Par.prototype.tempo = function(d) {
    return new Par(this.parts.map(function(p) { return p.tempo(d); }));
}
Seq.prototype.tempo = function(d) {
    return new Seq(this.parts.map(function(p) { return p.tempo(d); }));
}

/*
  With these functions in place, we can write, e.g.
     var faster_c = c.tempo(0.5)

  Similar transformation functions can be written to:
     * transpose a musical object, raising or lowering the pitch of each note
     * invert a musical object, reflecting the pitch of each note around a given pitch
     * reverse a musical object, so it plays backwards
*/
