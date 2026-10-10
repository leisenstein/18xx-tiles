namespace Tiles18xx.Api.Dtos;

// One line of an import report. Kind is a short code (see DataImporter.NoteKinds); Message is the sentence shown to admins.
public sealed record ImportNoteDto(string Kind, string Message);
