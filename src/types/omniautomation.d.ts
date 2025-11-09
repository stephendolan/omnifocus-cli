// TypeScript definitions for OmniFocus 4.8.5 (185.3) on macOS 15.6.1
// Generated on 2025-10-29 19:45:09 +0000

// To use these definitions, save this file as `OmniFocus.d.ts`
// and create a `tsconfig.json` file with compiler settings which indicate
// an appropriate set of implicitly defined TypeScript libraries:
//
// {
//     "compilerOptions": {
//         "lib": ["es7"]
//     }
// }


// Alert

declare class Alert {
    constructor (title: string, message: string);
    show(callback: (option: number) => void | null): Promise<number>;
    addOption(string: string): void;
}

// Application

declare class Application {
    openDocument(from: Document | null, url: URL, completed: (documentOrError: Document | Error, alreadyOpen: boolean) => void): void;
    readonly buildVersion: Version;
    readonly commandKeyDown: boolean;
    readonly controlKeyDown: boolean;
    readonly name: string;
    readonly optionKeyDown: boolean;
    readonly platformName: string;
    readonly shiftKeyDown: boolean;
    readonly userVersion: Version;
    readonly version: string;
}

// ApplyResult

declare namespace ApplyResult {
    const SkipChildren: ApplyResult;
    const SkipPeers: ApplyResult;
    const Stop: ApplyResult;
    const all: Array<ApplyResult>;
}

declare class ApplyResult {
}

// FolderArray

declare class FolderArray extends Array {
    byName(name: string): Folder | null;
}

// ProjectArray

declare class ProjectArray extends Array {
    byName(name: string): Project | null;
}

// SectionArray

declare class SectionArray extends Array {
    byName(name: string): Project | Folder | null;
}

// Library

declare class Library extends SectionArray {
    apply(f: (section: Project | Folder) => ApplyResult | null): ApplyResult | null;
    readonly beginning: Folder.ChildInsertionLocation;
    readonly ending: Folder.ChildInsertionLocation;
}

// TagArray

declare class TagArray extends Array {
    byName(name: string): Tag | null;
}

// Tags

declare class Tags extends TagArray {
    apply(f: (tag: Tag) => ApplyResult | null): ApplyResult | null;
    readonly beginning: Tag.ChildInsertionLocation;
    readonly ending: Tag.ChildInsertionLocation;
}

// TaskArray

declare class TaskArray extends Array {
    byName(name: string): Task | null;
}

// Inbox

declare class Inbox extends TaskArray {
    apply(f: (task: Task) => ApplyResult | null): ApplyResult | null;
    readonly beginning: Task.ChildInsertionLocation;
    readonly ending: Task.ChildInsertionLocation;
}

// Audio

declare namespace Audio {
    function playAlert(alert: Audio.Alert | null, completed: () => void | null): void;
}

declare class Audio {
}

// Audio.Alert

declare namespace Audio {
    class Alert {
        constructor (url: URL);
    }
}

// Calendar

declare namespace Calendar {
    const buddhist: Calendar;
    const chinese: Calendar;
    const coptic: Calendar;
    const current: Calendar;
    const ethiopicAmeteAlem: Calendar;
    const ethiopicAmeteMihret: Calendar;
    const gregorian: Calendar;
    const hebrew: Calendar;
    const indian: Calendar;
    const islamic: Calendar;
    const islamicCivil: Calendar;
    const islamicTabular: Calendar;
    const islamicUmmAlQura: Calendar;
    const iso8601: Calendar;
    const japanese: Calendar;
    const persian: Calendar;
    const republicOfChina: Calendar;
}

declare class Calendar {
    dateByAddingDateComponents(date: Date, components: DateComponents): Date | null;
    dateFromDateComponents(components: DateComponents): Date | null;
    dateComponentsFromDate(date: Date): DateComponents;
    dateComponentsBetweenDates(start: Date, end: Date): DateComponents;
    startOfDay(date: Date): Date;
    readonly identifier: string;
    readonly locale: Locale | null;
    readonly timeZone: TimeZone;
}

// Color

declare namespace Color {
    function RGB(r: number, g: number, b: number, a: number | null): Color;
    function hex(hexString: string, a: number | null): Color | null;
    function HSB(h: number, s: number, b: number, a: number | null): Color;
    function White(w: number, a: number | null): Color;
    const black: Color;
    const blue: Color;
    const brown: Color;
    const clear: Color;
    const cyan: Color;
    const darkGray: Color;
    const gray: Color;
    const green: Color;
    const lightGray: Color;
    const magenta: Color;
    const orange: Color;
    const purple: Color;
    const red: Color;
    const white: Color;
    const yellow: Color;
}

declare class Color {
    blend(otherColor: Color, fraction: number): Color | null;
    readonly alpha: number;
    readonly blue: number;
    readonly brightness: number;
    readonly colorSpace: ColorSpace;
    readonly green: number;
    readonly hex: string;
    readonly hue: number;
    readonly red: number;
    readonly saturation: number;
    readonly white: number;
}

// ColorSpace

declare namespace ColorSpace {
    const CMYK: ColorSpace;
    const HSB: ColorSpace;
    const Named: ColorSpace;
    const Pattern: ColorSpace;
    const RGB: ColorSpace;
    const White: ColorSpace;
    const all: Array<ColorSpace>;
}

declare class ColorSpace {
}

// CombinedValues

declare class CombinedValues {
    readonly name: string;
    readonly values: Array<unknown>;
}

// Console

declare class Console {
    log(message: unknown, additional: Array<unknown | null>): void;
    error(message: unknown, additional: Array<unknown | null>): void;
    info(message: unknown, additional: Array<unknown | null>): void;
    warn(message: unknown, additional: Array<unknown | null>): void;
    clear(): void;
}

// Credentials

declare class Credentials {
    constructor ();
    read(service: string): object | null;
    write(service: string, username: string, password: string): void;
    remove(service: string): void;
    readBookmark(service: string): URL.Bookmark | null;
    writeBookmark(service: string, bookmark: URL.Bookmark): void;
}

// Crypto

declare namespace Crypto {
    function randomData(length: number): Data;
}

declare class Crypto {
}

// Crypto.SHA256

declare namespace Crypto {
    class SHA256 {
        constructor ();
        update(data: Data): void;
        finalize(): Data;
    }
}

// Crypto.SHA384

declare namespace Crypto {
    class SHA384 {
        constructor ();
        update(data: Data): void;
        finalize(): Data;
    }
}

// Crypto.SHA512

declare namespace Crypto {
    class SHA512 {
        constructor ();
        update(data: Data): void;
        finalize(): Data;
    }
}

// Data

declare namespace Data {
    function fromString(string: string, encoding: StringEncoding | null): Data;
    function fromBase64(string: string): Data;
}

declare class Data {
    toString(encoding: StringEncoding | null): string;
    toBase64(): string;
    readonly length: number;
    readonly toObject: unknown | null;
}

// Database

declare class Database {
    objectForURL(url: URL): DatabaseObject | null;
    tagNamed(name: string): Tag | null;
    folderNamed(name: string): Folder | null;
    projectNamed(name: string): Project | null;
    projectsMatching(search: string): Array<Project>;
    foldersMatching(search: string): Array<Folder>;
    tagsMatching(search: string): Array<Tag>;
    taskNamed(name: string): Task | null;
    save(): void;
    moveTasks(tasks: Array<Task>, position: Project | Task | Task.ChildInsertionLocation): void;
    duplicateTasks(tasks: Array<Task>, position: Project | Task | Task.ChildInsertionLocation): TaskArray;
    convertTasksToProjects(tasks: Array<Task>, position: Folder | Folder.ChildInsertionLocation): Array<Project>;
    moveSections(sections: Array<Project | Folder>, position: Folder | Folder.ChildInsertionLocation): void;
    duplicateSections(sections: Array<Project | Folder>, position: Folder | Folder.ChildInsertionLocation): SectionArray;
    moveTags(tags: Array<Tag>, position: Tag | Tag.ChildInsertionLocation): void;
    duplicateTags(tags: Array<Tag>, position: Tag | Tag.ChildInsertionLocation): TagArray;
    cleanUp(): void;
    undo(): void;
    redo(): void;
    deleteObject(object: DatabaseObject): void;
    copyTasksToPasteboard(tasks: Array<Task>, pasteboard: Pasteboard): void;
    canPasteTasks(pasteboard: Pasteboard): boolean;
    pasteTasksFromPasteboard(pasteboard: Pasteboard): Array<Task>;
    readonly app: Application;
    readonly baseStyle: Style;
    readonly canRedo: boolean;
    readonly canUndo: boolean;
    readonly console: Console;
    readonly document: DatabaseDocument | null;
    readonly flattenedFolders: FolderArray;
    readonly flattenedProjects: ProjectArray;
    readonly flattenedSections: SectionArray;
    readonly flattenedTags: TagArray;
    readonly flattenedTasks: TaskArray;
    readonly folders: FolderArray;
    readonly inbox: Inbox;
    readonly library: Library;
    readonly projects: ProjectArray;
    readonly settings: Settings;
    readonly tags: Tags;
}

// Database.Fetch

declare namespace Database {
    class Fetch {
        readonly type: Database.Fetch.Type;
    }
}

// Database.Fetch.Type

declare namespace Database.Fetch.Type {
    const Inbox: Database.Fetch.Type;
    const Other: Database.Fetch.Type;
    const Untagged: Database.Fetch.Type;
    const all: Array<Database.Fetch.Type>;
}

declare namespace Database.Fetch {
    class Type {
    }
}

// DatabaseObject

declare class DatabaseObject {
    readonly id: ObjectIdentifier;
    readonly url: URL | null;
}

// DatedObject

declare class DatedObject extends DatabaseObject {
    added: Date | null;
    modified: Date | null;
}

// ActiveObject

declare class ActiveObject extends DatedObject {
    active: boolean;
    readonly effectiveActive: boolean;
}

// Folder

declare namespace Folder {
    function byIdentifier(identifier: string): Folder | null;
}

declare class Folder extends ActiveObject {
    constructor (name: string, position: Folder | Folder.ChildInsertionLocation | null);
    folderNamed(name: string): Folder | null;
    projectNamed(name: string): Project | null;
    sectionNamed(name: string): Project | Folder | null;
    childNamed(name: string): Project | Folder | null;
    apply(f: (folder: Folder) => ApplyResult | null): ApplyResult | null;
    readonly after: Folder.ChildInsertionLocation;
    readonly before: Folder.ChildInsertionLocation;
    readonly beginning: Folder.ChildInsertionLocation;
    readonly children: SectionArray;
    readonly ending: Folder.ChildInsertionLocation;
    readonly flattenedChildren: SectionArray;
    readonly flattenedFolders: FolderArray;
    readonly flattenedProjects: ProjectArray;
    readonly flattenedSections: SectionArray;
    readonly folders: FolderArray;
    name: string;
    readonly parent: Folder | null;
    readonly projects: ProjectArray;
    readonly sections: SectionArray;
    status: Folder.Status;
}

// Tag

declare namespace Tag {
    function byIdentifier(identifier: string): Tag | null;
    const forecastTag: Tag | null;
}

declare class Tag extends ActiveObject {
    constructor (name: string, position: Tag | Tag.ChildInsertionLocation | null);
    tagNamed(name: string): Tag | null;
    childNamed(name: string): Tag | null;
    beforeTask(task: Task | null): Tag.TaskInsertionLocation;
    afterTask(task: Task | null): Tag.TaskInsertionLocation;
    moveTask(task: Task, location: Tag.TaskInsertionLocation): void;
    moveTasks(tasks: Array<Task>, location: Tag.TaskInsertionLocation): void;
    apply(f: (tag: Tag) => ApplyResult | null): ApplyResult | null;
    readonly after: Tag.ChildInsertionLocation;
    allowsNextAction: boolean;
    readonly availableTasks: TaskArray;
    readonly before: Tag.ChildInsertionLocation;
    readonly beginning: Tag.ChildInsertionLocation;
    readonly beginningOfTasks: Tag.TaskInsertionLocation;
    readonly children: TagArray;
    childrenAreMutuallyExclusive: boolean;
    readonly ending: Tag.ChildInsertionLocation;
    readonly endingOfTasks: Tag.TaskInsertionLocation;
    readonly flattenedChildren: TagArray;
    readonly flattenedTags: TagArray;
    name: string;
    readonly parent: Tag | null;
    readonly projects: ProjectArray;
    readonly remainingTasks: TaskArray;
    status: Tag.Status;
    readonly tags: TagArray;
    readonly tasks: TaskArray;
}

// Task

declare namespace Task {
    function byParsingTransportText(text: string, singleTask: boolean | null): Array<Task>;
    function byIdentifier(identifier: string): Task | null;
}

declare class Task extends ActiveObject {
    constructor (name: string, position: Project | Task | Task.ChildInsertionLocation | null);
    taskNamed(name: string): Task | null;
    childNamed(name: string): Task | null;
    appendStringToNote(stringToAppend: string): void;
    addLinkedFileURL(url: URL): void;
    removeLinkedFileWithURL(url: URL): void;
    addAttachment(attachment: FileWrapper): void;
    removeAttachmentAtIndex(index: number): void;
    beforeTag(tag: Tag | null): Task.TagInsertionLocation;
    afterTag(tag: Tag | null): Task.TagInsertionLocation;
    addTag(tag: Tag, location: Task.TagInsertionLocation | null): void;
    addTags(tags: Array<Tag>, location: Task.TagInsertionLocation | null): void;
    moveTag(tag: Tag, location: Task.TagInsertionLocation): void;
    moveTags(tags: Array<Tag>, location: Task.TagInsertionLocation): void;
    removeTag(tag: Tag): void;
    removeTags(tags: Array<Tag>): void;
    clearTags(): void;
    markComplete(date: Date | null): Task;
    markIncomplete(): void;
    drop(allOccurrences: boolean, dateDropped: Date | null): void;
    apply(f: (task: Task) => ApplyResult | null): ApplyResult | null;
    addNotification(info: number | Date): Task.Notification;
    removeNotification(notification: Task.Notification): void;
    readonly after: Task.ChildInsertionLocation;
    assignedContainer: Project | Task | Inbox | null;
    attachments: Array<FileWrapper>;
    readonly before: Task.ChildInsertionLocation;
    readonly beginning: Task.ChildInsertionLocation;
    readonly beginningOfTags: Task.TagInsertionLocation;
    readonly children: TaskArray;
    readonly completed: boolean;
    completedByChildren: boolean;
    readonly completionDate: Date | null;
    readonly containingProject: Project | null;
    deferDate: Date | null;
    readonly dropDate: Date | null;
    dueDate: Date | null;
    readonly effectiveCompletedDate: Date | null;
    readonly effectiveCompletionDate: Date | null;
    readonly effectiveDeferDate: Date | null;
    readonly effectiveDropDate: Date | null;
    readonly effectiveDueDate: Date | null;
    readonly effectiveFlagged: boolean;
    readonly effectivePlannedDate: Date | null;
    readonly ending: Task.ChildInsertionLocation;
    readonly endingOfTags: Task.TagInsertionLocation;
    estimatedMinutes: number | null;
    flagged: boolean;
    readonly flattenedChildren: TaskArray;
    readonly flattenedTasks: TaskArray;
    readonly hasChildren: boolean;
    readonly inInbox: boolean;
    readonly linkedFileURLs: Array<URL>;
    name: string;
    note: string;
    noteText: Text;
    readonly notifications: Array<Task.Notification>;
    readonly parent: Task | null;
    plannedDate: Date | null;
    readonly project: Project | null;
    repetitionRule: Task.RepetitionRule | null;
    sequential: boolean;
    shouldUseFloatingTimeZone: boolean;
    readonly tags: TagArray;
    readonly taskStatus: Task.Status;
    readonly tasks: TaskArray;
}

// Perspective.Custom

declare namespace Perspective.Custom {
    function byName(name: string): Perspective.Custom | null;
    function byIdentifier(identifier: string): Perspective.Custom | null;
    const all: Array<Perspective.Custom>;
}

declare namespace Perspective {
    class Custom extends DatedObject {
        fileWrapper(): FileWrapper;
        writeFileRepresentationIntoDirectory(parentURL: URL): URL;
        archivedFilterRules: unknown;
        archivedTopLevelFilterAggregation: string | null;
        iconColor: Color | null;
        readonly identifier: string;
        name: string;
    }
}

// Task.Notification

declare namespace Task {
    class Notification extends DatedObject {
        absoluteFireDate: Date;
        readonly initialFireDate: Date;
        readonly isSnoozed: boolean;
        readonly kind: Task.Notification.Kind;
        readonly nextFireDate: Date | null;
        relativeFireOffset: number;
        repeatInterval: number;
        readonly task: Task | null;
        readonly usesFloatingTimeZone: boolean;
    }
}

// Project

declare namespace Project {
    function byIdentifier(identifier: string): Project | null;
}

declare class Project extends DatabaseObject {
    constructor (name: string, position: Folder | Folder.ChildInsertionLocation | null);
    taskNamed(name: string): Task | null;
    appendStringToNote(stringToAppend: string): void;
    addAttachment(attachment: FileWrapper): void;
    removeAttachmentAtIndex(index: number): void;
    markComplete(date: Date | null): Task;
    markIncomplete(): void;
    addNotification(info: number | Date): Task.Notification;
    removeNotification(notification: Task.Notification): void;
    addTag(tag: Tag): void;
    addTags(tags: Array<Tag>): void;
    removeTag(tag: Tag): void;
    removeTags(tags: Array<Tag>): void;
    clearTags(): void;
    addLinkedFileURL(url: URL): void;
    removeLinkedFileWithURL(url: URL): void;
    readonly after: Folder.ChildInsertionLocation;
    attachments: Array<FileWrapper>;
    readonly before: Folder.ChildInsertionLocation;
    readonly beginning: Task.ChildInsertionLocation;
    readonly children: TaskArray;
    readonly completed: boolean;
    completedByChildren: boolean;
    completionDate: Date | null;
    containsSingletonActions: boolean;
    defaultSingletonActionHolder: boolean;
    deferDate: Date | null;
    dropDate: Date | null;
    dueDate: Date | null;
    readonly effectiveCompletedDate: Date | null;
    readonly effectiveDeferDate: Date | null;
    readonly effectiveDropDate: Date | null;
    readonly effectiveDueDate: Date | null;
    readonly effectiveFlagged: boolean;
    readonly effectivePlannedDate: Date | null;
    readonly ending: Task.ChildInsertionLocation;
    estimatedMinutes: number | null;
    flagged: boolean;
    readonly flattenedChildren: TaskArray;
    readonly flattenedTasks: TaskArray;
    readonly hasChildren: boolean;
    lastReviewDate: Date | null;
    readonly linkedFileURLs: Array<URL>;
    name: string;
    nextReviewDate: Date | null;
    readonly nextTask: Task | null;
    note: string;
    noteText: Text;
    readonly notifications: Array<Task.Notification>;
    readonly parentFolder: Folder | null;
    plannedDate: Date | null;
    repetitionRule: Task.RepetitionRule | null;
    reviewInterval: Project.ReviewInterval;
    sequential: boolean;
    shouldUseFloatingTimeZone: boolean;
    status: Project.Status;
    readonly tags: TagArray;
    readonly task: Task;
    readonly taskStatus: Task.Status;
    readonly tasks: TaskArray;
}

// DateComponents

declare class DateComponents {
    constructor ();
    readonly date: Date | null;
    day: number | null;
    era: number | null;
    hour: number | null;
    minute: number | null;
    month: number | null;
    nanosecond: number | null;
    second: number | null;
    timeZone: TimeZone | null;
    year: number | null;
}

// DateRange

declare class DateRange {
    readonly end: Date;
    readonly name: string;
    readonly start: Date;
}

// Decimal

declare namespace Decimal {
    function fromString(string: string): Decimal;
    const maximum: Decimal;
    const minimum: Decimal;
    const notANumber: Decimal;
    const one: Decimal;
    const zero: Decimal;
}

declare class Decimal {
    toString(): string;
    add(number: Decimal): Decimal;
    subtract(number: Decimal): Decimal;
    multiply(number: Decimal): Decimal;
    divide(number: Decimal): Decimal;
    compare(number: Decimal): number;
    equals(number: Decimal): boolean;
}

// Device

declare namespace Device {
    const current: Device;
}

declare class Device {
    readonly iOS: boolean;
    readonly iPad: boolean;
    readonly mac: boolean;
    readonly operatingSystemBuildNumber: string;
    readonly operatingSystemVersion: Version;
    readonly type: DeviceType | null;
    readonly visionPro: boolean;
}

// DeviceType

declare namespace DeviceType {
    const all: Array<DeviceType>;
    const iPad: DeviceType;
    const iPhone: DeviceType;
    const mac: DeviceType;
    const visionPro: DeviceType;
}

declare class DeviceType {
}

// Document

declare namespace Document {
    function makeNew(resultFunction: (document: Document | Error) => void | null): Promise<Document>;
    function makeNewAndShow(resultFunction: (document: Document | Error) => void | null): Promise<Document>;
}

declare class Document {
    close(didCancel: (document: Document) => void | null): void;
    save(): void;
    fileWrapper(type: string | null): FileWrapper;
    makeFileWrapper(baseName: string, type: string | null): Promise<FileWrapper>;
    undo(): void;
    redo(): void;
    show(completed: () => void | null): void;
    createOmniLinkURL(additionalQueryItems: Array<URL.QueryItem> | null, additionalPromptMessage: string | null): Promise<URL>;
    readonly canRedo: boolean;
    readonly canUndo: boolean;
    readonly fileType: string | null;
    readonly fileURL: URL | null;
    readonly name: string | null;
    readonly omniLink: URL | null;
    readonly writableTypes: Array<string>;
}

// DatabaseDocument

declare class DatabaseDocument extends Document {
    newWindow(): Promise<DocumentWindow>;
    newTabOnWindow(window: DocumentWindow): Promise<DocumentWindow>;
    sync(): Promise<boolean>;
    readonly windows: Array<DocumentWindow>;
}

// Email

declare class Email {
    constructor ();
    generate(): void;
    blindCarbonCopy: string | Array<string> | null;
    body: string | null;
    carbonCopy: string | Array<string> | null;
    fileWrappers: Array<FileWrapper>;
    receiver: string | Array<string> | null;
    subject: string | null;
}

// FilePicker

declare class FilePicker {
    constructor ();
    show(): Promise<Array<URL>>;
    folders: boolean;
    message: string;
    multiple: boolean;
    types: Array<TypeIdentifier> | null;
}

// FileSaver

declare class FileSaver {
    constructor ();
    show(fileWrapper: FileWrapper): Promise<URL>;
    message: string;
    nameLabel: string;
    prompt: string;
    types: Array<TypeIdentifier> | null;
}

// FileWrapper

declare namespace FileWrapper {
    function withContents(name: string | null, contents: Data): FileWrapper;
    function withChildren(name: string | null, children: Array<FileWrapper>): FileWrapper;
    function fromURL(url: URL, options: Array<FileWrapper.ReadingOptions> | null): FileWrapper;
}

declare class FileWrapper {
    childNamed(name: string): FileWrapper | null;
    filenameForChild(child: FileWrapper): string | null;
    write(url: URL, options: Array<FileWrapper.WritingOptions> | null, originalContentsURL: URL | null): void;
    readonly children: Array<FileWrapper>;
    readonly contents: Data | null;
    readonly destination: URL | null;
    filename: string | null;
    preferredFilename: string | null;
    readonly type: FileWrapper.Type;
}

// FileWrapper.ReadingOptions

declare namespace FileWrapper.ReadingOptions {
    const Immediate: FileWrapper.ReadingOptions;
    const WihtoutMapping: FileWrapper.ReadingOptions;
    const all: Array<FileWrapper.ReadingOptions>;
}

declare namespace FileWrapper {
    class ReadingOptions {
    }
}

// FileWrapper.Type

declare namespace FileWrapper.Type {
    const Directory: FileWrapper.Type;
    const File: FileWrapper.Type;
    const Link: FileWrapper.Type;
    const all: Array<FileWrapper.Type>;
}

declare namespace FileWrapper {
    class Type {
    }
}

// FileWrapper.WritingOptions

declare namespace FileWrapper.WritingOptions {
    const Atomic: FileWrapper.WritingOptions;
    const UpdateNames: FileWrapper.WritingOptions;
    const all: Array<FileWrapper.WritingOptions>;
}

declare namespace FileWrapper {
    class WritingOptions {
    }
}

// Folder.ChildInsertionLocation

declare namespace Folder {
    class ChildInsertionLocation {
    }
}

// Folder.Status

declare namespace Folder.Status {
    const Active: Folder.Status;
    const Dropped: Folder.Status;
    const all: Array<Folder.Status>;
}

declare namespace Folder {
    class Status {
    }
}

// ForecastDay

declare namespace ForecastDay {
    let badgeCountsIncludeDeferredItems: boolean;
}

declare class ForecastDay {
    badgeKind(): ForecastDay.Status;
    readonly badgeCount: number;
    readonly date: Date;
    readonly deferredCount: number;
    readonly kind: ForecastDay.Kind;
    readonly name: string;
}

// ForecastDay.Kind

declare namespace ForecastDay.Kind {
    const Day: ForecastDay.Kind;
    const DistantFuture: ForecastDay.Kind;
    const FutureMonth: ForecastDay.Kind;
    const Past: ForecastDay.Kind;
    const Today: ForecastDay.Kind;
    const all: Array<ForecastDay.Kind>;
}

declare namespace ForecastDay {
    class Kind {
    }
}

// ForecastDay.Status

declare namespace ForecastDay.Status {
    const Available: ForecastDay.Status;
    const DueSoon: ForecastDay.Status;
    const NoneAvailable: ForecastDay.Status;
    const Overdue: ForecastDay.Status;
    const all: Array<ForecastDay.Status>;
}

declare namespace ForecastDay {
    class Status {
    }
}

// Form

declare class Form {
    constructor ();
    addField(field: Form.Field, index: number | null): void;
    removeField(field: Form.Field): void;
    show(title: string, confirmTitle: string): Promise<Form>;
    readonly fields: Array<Form.Field>;
    validate: (Form: Form) => boolean | null;
    readonly values: unknown;
}

// Form.Field

declare namespace Form {
    class Field {
        readonly displayName: string | null;
        readonly key: string;
    }
}

// Form.Field.Checkbox

declare namespace Form.Field {
    class Checkbox extends Form.Field {
        constructor (key: string, displayName: string | null, value: boolean | null);
    }
}

// Form.Field.Date

declare namespace Form.Field {
    class Date extends Form.Field {
        constructor (key: string, displayName: string | null, value: Date | null, formatter: Formatter.Date | null);
    }
}

// Form.Field.MultipleOptions

declare namespace Form.Field {
    class MultipleOptions extends Form.Field {
        constructor (key: string, displayName: string | null, options: Array<unknown>, names: Array<string> | null, selected: Array<unknown>);
    }
}

// Form.Field.Option

declare namespace Form.Field {
    class Option extends Form.Field {
        constructor (key: string, displayName: string | null, options: Array<unknown>, names: Array<string> | null, selected: unknown | null, nullOptionTitle: string | null);
        allowsNull: boolean;
        nullOptionTitle: string | null;
    }
}

// Form.Field.Password

declare namespace Form.Field {
    class Password extends Form.Field {
        constructor (key: string, displayName: string | null, value: string | null);
    }
}

// Form.Field.String

declare namespace Form.Field {
    class String extends Form.Field {
        constructor (key: string, displayName: string | null, value: unknown | null, formatter: Formatter | null);
    }
}

// Formatter

declare class Formatter {
}

// Formatter.Date

declare namespace Formatter.Date {
    function withStyle(dateStyle: Formatter.Date.Style, timeStyle: Formatter.Date.Style | null): Formatter.Date;
    function withFormat(format: string): Formatter.Date;
    const iso8601: Formatter.Date;
}

declare namespace Formatter {
    class Date extends Formatter {
        stringFromDate(date: Date): string;
        dateFromString(string: string): Date | null;
        calendar: Calendar;
        readonly dateFormat: string;
        locale: Locale;
        timeZone: TimeZone;
    }
}

// Formatter.Decimal

declare namespace Formatter.Decimal {
    function currency(code: string | null): Formatter.Decimal;
    const currencyCodes: Array<string>;
    const custom: Formatter.Decimal;
    const decimal: Formatter.Decimal;
    const percent: Formatter.Decimal;
    const percentWithDecimal: Formatter.Decimal;
    const plain: Formatter.Decimal;
    const thousandsAndDecimal: Formatter.Decimal;
}

declare namespace Formatter {
    class Decimal extends Formatter {
        stringFromDecimal(number: Decimal): string | null;
        decimalFromString(string: string): Decimal | null;
        decimalSeparator: string;
        negativeFormat: string;
        positiveFormat: string;
        thousandsSeparator: string | null;
        zeroSymbol: string | null;
    }
}

// Formatter.Duration

declare namespace Formatter {
    class Duration extends Formatter {
        constructor ();
        stringFromDecimal(number: Decimal): string | null;
        decimalFromString(string: string): Decimal | null;
        hoursPerDay: number;
        hoursPerWeek: number;
        useVerboseFormat: boolean;
    }
}

// Formatter.Date.Style

declare namespace Formatter.Date.Style {
    const Full: Formatter.Date.Style;
    const Long: Formatter.Date.Style;
    const Medium: Formatter.Date.Style;
    const Short: Formatter.Date.Style;
    const all: Array<Formatter.Date.Style>;
}

declare namespace Formatter.Date {
    class Style {
    }
}

// Image

declare namespace Image {
    function symbolNamed(name: string): Image | null;
}

declare class Image {
}

// LanguageModel

declare class LanguageModel {
}

// LanguageModel.GenerationOptions

declare namespace LanguageModel {
    class GenerationOptions {
        constructor ();
        maximumResponseTokens: number | null;
    }
}

// LanguageModel.Schema

declare namespace LanguageModel.Schema {
    function fromJSON(json: unknown): LanguageModel.Schema;
}

declare namespace LanguageModel {
    class Schema {
    }
}

// LanguageModel.Session

declare namespace LanguageModel.Session {
    function withTools(tools: Array<_omnijs_AnonymousProxy>, instructions: string | null): LanguageModel.Session;
}

declare namespace LanguageModel {
    class Session {
        constructor (instructions: string | null);
        respond(prompt: string): Promise<string>;
        respondWithSchema(prompt: string, schema: LanguageModel.Schema, generationOptions: LanguageModel.GenerationOptions | null): Promise<string>;
    }
}

// LigatureStyle

declare namespace LigatureStyle {
    const All: LigatureStyle;
    const Essential: LigatureStyle;
    const Standard: LigatureStyle;
    const all: Array<LigatureStyle>;
}

declare class LigatureStyle {
}

// Locale

declare namespace Locale {
    const identifiers: Array<string>;
}

declare class Locale {
    constructor (identifier: string);
    readonly calendar: Calendar;
    readonly currencyCode: string | null;
    readonly identifier: string;
}

// MenuItem

declare class MenuItem {
    checked: boolean;
    image: Image | null;
    label: string;
}

// NamedStyle.List

declare namespace NamedStyle {
    class List {
        add(name: string | null): NamedStyle;
        byName(name: string): NamedStyle | null;
        byIdentifier(identifier: string): NamedStyle | null;
        moveStyles(styles: Array<NamedStyle>, position: NamedStylePosition): void;
        duplicateStyles(styles: Array<NamedStyle>, position: NamedStylePosition): Array<NamedStyle>;
        readonly all: Array<NamedStyle>;
        readonly beginning: NamedStylePosition;
        readonly end: NamedStylePosition;
    }
}

// NamedStylePosition

declare class NamedStylePosition {
}

// Notification

declare class Notification {
    constructor (title: string);
    show(): Promise<Notification>;
    subtitle: string | null;
    title: string;
}

// ObjectIdentifier

declare class ObjectIdentifier {
    readonly objectClass: unknown | null;
    readonly primaryKey: string;
}

// Pasteboard

declare namespace Pasteboard {
    function makeUnique(): Pasteboard;
    const general: Pasteboard;
}

declare class Pasteboard {
    availableType(types: Array<TypeIdentifier>): TypeIdentifier | null;
    addItems(items: Array<Pasteboard.Item>): void;
    clear(): void;
    dataForType(type: TypeIdentifier): Data | null;
    setDataForType(data: Data, type: TypeIdentifier): void;
    stringForType(type: TypeIdentifier): string | null;
    setStringForType(string: string, type: TypeIdentifier): void;
    URL: URL | null;
    URLs: Array<URL> | null;
    color: Color | null;
    colors: Array<Color> | null;
    readonly hasColors: boolean;
    readonly hasImages: boolean;
    readonly hasStrings: boolean;
    readonly hasURLs: boolean;
    image: Image | null;
    images: Array<Image> | null;
    items: Array<Pasteboard.Item>;
    string: string | null;
    strings: Array<string> | null;
    readonly types: Array<TypeIdentifier>;
}

// Pasteboard.Item

declare namespace Pasteboard {
    class Item {
        constructor ();
        dataForType(type: TypeIdentifier): Data | null;
        setDataForType(data: Data, type: TypeIdentifier): void;
        stringForType(type: TypeIdentifier): string | null;
        setStringForType(string: string, type: TypeIdentifier): void;
        readonly types: Array<TypeIdentifier>;
    }
}

// Perspective

declare namespace Perspective {
    const all: Array<Perspective.BuiltIn | Perspective.Custom>;
    const favorites: Array<Perspective.BuiltIn | Perspective.Custom>;
}

declare class Perspective {
}

// Perspective.BuiltIn

declare namespace Perspective.BuiltIn {
    const Flagged: Perspective.BuiltIn;
    const Forecast: Perspective.BuiltIn;
    const Inbox: Perspective.BuiltIn;
    const Nearby: Perspective.BuiltIn;
    const Projects: Perspective.BuiltIn;
    const Review: Perspective.BuiltIn;
    const Search: Perspective.BuiltIn;
    const Tags: Perspective.BuiltIn;
    const all: Array<Perspective.BuiltIn>;
}

declare namespace Perspective {
    class BuiltIn {
        readonly name: string;
    }
}

// PlugIn

declare namespace PlugIn {
    function find(identifier: string, minimumVersion: Version | null): PlugIn | null;
    const all: Array<PlugIn>;
}

declare class PlugIn {
    library(identifier: string): PlugIn.Library | null;
    action(identifier: string): PlugIn.Action | null;
    handler(identifier: string): PlugIn.Handler | null;
    resourceNamed(name: string): URL | null;
    imageNamed(name: string): Image | null;
    localizedResourceNamed(filename: string): FileWrapper | null;
    readonly URL: URL | null;
    readonly actions: Array<PlugIn.Action>;
    readonly author: string;
    readonly description: string;
    readonly displayName: string;
    readonly handlers: Array<PlugIn.Handler>;
    readonly identifier: string;
    readonly libraries: Array<PlugIn.Library>;
    readonly version: Version;
}

// PlugIn.Action

declare namespace PlugIn {
    class Action {
        constructor (perform: (...args: unknown[]) => unknown);
        readonly description: string;
        readonly label: string;
        readonly longLabel: string;
        readonly mediumLabel: string;
        readonly name: string;
        readonly paletteLabel: string;
        readonly perform: (...args: unknown[]) => unknown;
        readonly plugIn: PlugIn;
        readonly shortLabel: string;
        validate: (...args: unknown[]) => unknown | null;
    }
}

// PlugIn.Handler

declare namespace PlugIn {
    class Handler {
        constructor (invoke: (...args: unknown[]) => unknown);
        readonly invoke: (...args: unknown[]) => unknown;
        readonly name: string;
        readonly plugIn: PlugIn;
        willAttach: (...args: unknown[]) => unknown | null;
        willDetach: (...args: unknown[]) => unknown | null;
    }
}

// PlugIn.Library

declare namespace PlugIn {
    class Library {
        constructor (version: Version);
        readonly name: string;
        readonly plugIn: PlugIn;
        readonly version: Version;
    }
}

// Preferences

declare class Preferences {
    constructor (identifier: string | null);
    read(key: string): unknown | null;
    readBoolean(key: string): boolean;
    readString(key: string): string | null;
    readNumber(key: string): number;
    readDate(key: string): Date | null;
    readData(key: string): Data | null;
    write(key: string, value: boolean | string | number | Date | Data | null): void;
    remove(key: string): void;
    readonly identifier: string;
}

// Project.ReviewInterval

declare namespace Project {
    class ReviewInterval {
        steps: number;
        unit: string;
    }
}

// Project.Status

declare namespace Project.Status {
    const Active: Project.Status;
    const Done: Project.Status;
    const Dropped: Project.Status;
    const OnHold: Project.Status;
    const all: Array<Project.Status>;
}

declare namespace Project {
    class Status {
    }
}

// QuickOpenScriptAction

declare class QuickOpenScriptAction {
    image: Image | null;
    label: string;
}

// Selection

declare class Selection {
    readonly allObjects: Array<unknown>;
    readonly database: Database | null;
    readonly databaseObjects: Array<DatabaseObject>;
    readonly document: DatabaseDocument | null;
    readonly folders: FolderArray;
    readonly projects: ProjectArray;
    readonly tags: TagArray;
    readonly tasks: TaskArray;
    readonly window: DocumentWindow | null;
}

// Settings

declare class Settings {
    defaultObjectForKey(key: string): unknown | null;
    hasNonDefaultObjectForKey(key: string): boolean;
    objectForKey(key: string): unknown | null;
    setObjectForKey(value: unknown | null, key: string): void;
    boolForKey(key: string): boolean;
    setBoolForKey(value: boolean, key: string): void;
    integerForKey(key: string): number;
    setIntegerForKey(value: number, key: string): void;
    readonly keys: Array<string>;
}

// SharePanel

declare class SharePanel {
    constructor (items: Array<URL | string | Image | FileWrapper>);
    addItem(shareItem: URL | string | Image | FileWrapper): void;
    addItems(shareItems: Array<URL | string | Image | FileWrapper>): void;
    removeItem(shareItem: URL | string | Image | FileWrapper): void;
    removeItems(shareItems: Array<URL | string | Image | FileWrapper>): void;
    clearItems(): void;
    show(): void;
    items: Array<URL | string | Image | FileWrapper>;
}

// Speech

declare class Speech {
}

// Speech.Boundary

declare namespace Speech.Boundary {
    const Immediate: Speech.Boundary;
    const Word: Speech.Boundary;
    const all: Array<Speech.Boundary>;
}

declare namespace Speech {
    class Boundary {
    }
}

// Speech.Synthesizer

declare namespace Speech {
    class Synthesizer {
        constructor ();
        speakUtterance(utterance: Speech.Utterance): void;
        stopSpeaking(boundary: Speech.Boundary): boolean;
        pauseSpeaking(boundary: Speech.Boundary): boolean;
        continueSpeaking(): boolean;
        readonly paused: boolean;
        readonly speaking: boolean;
    }
}

// Speech.Utterance

declare namespace Speech.Utterance {
    const defaultSpeechRate: number;
    const maximumSpeechRate: number;
    const minimumSpeechRate: number;
}

declare namespace Speech {
    class Utterance {
        constructor (string: string);
        pitchMultiplier: number;
        postUtteranceDelay: number;
        preUtteranceDelay: number;
        prefersAssistiveTechnologySettings: boolean;
        rate: number;
        readonly string: string | null;
        voice: Speech.Voice | null;
        volume: number;
    }
}

// Speech.Voice

declare namespace Speech.Voice {
    function withLanguage(code: string | null): Speech.Voice | null;
    function withIdentifier(identifier: string): Speech.Voice | null;
    const allVoices: Array<Speech.Voice>;
    const currentLanguageCode: string;
}

declare namespace Speech {
    class Voice {
        readonly gender: Speech.Voice.Gender;
        readonly identifier: string;
        readonly language: string;
        readonly name: string;
    }
}

// Speech.Voice.Gender

declare namespace Speech.Voice.Gender {
    const Female: Speech.Voice.Gender;
    const Male: Speech.Voice.Gender;
    const Unspecified: Speech.Voice.Gender;
    const all: Array<Speech.Voice.Gender>;
}

declare namespace Speech.Voice {
    class Gender {
    }
}

// StringEncoding

declare namespace StringEncoding {
    const ASCII: StringEncoding;
    const ISO2022JP: StringEncoding;
    const ISOLatin1: StringEncoding;
    const ISOLatin2: StringEncoding;
    const JapaneseEUC: StringEncoding;
    const MacOSRoman: StringEncoding;
    const NextStep: StringEncoding;
    const NonLossyASCII: StringEncoding;
    const ShiftJIS: StringEncoding;
    const Symbol: StringEncoding;
    const UTF16: StringEncoding;
    const UTF16BigEndian: StringEncoding;
    const UTF16LittleEndian: StringEncoding;
    const UTF32: StringEncoding;
    const UTF32BigEndian: StringEncoding;
    const UTF32LittleEndian: StringEncoding;
    const UTF8: StringEncoding;
    const Unicode: StringEncoding;
    const WindowsCP1250: StringEncoding;
    const WindowsCP1251: StringEncoding;
    const WindowsCP1252: StringEncoding;
    const WindowsCP1253: StringEncoding;
    const WindowsCP1254: StringEncoding;
    const all: Array<StringEncoding>;
}

declare class StringEncoding {
}

// Style

declare class Style {
    set(attribute: Style.Attribute, value: unknown | null): boolean;
    get(attribute: Style.Attribute): unknown | null;
    localValueForAttribute(attribute: Style.Attribute): unknown | null;
    addNamedStyle(namedStyle: NamedStyle): void;
    removeNamedStyle(namedStyle: NamedStyle): void;
    influencedBy(otherStyle: Style): boolean;
    setStyle(style: Style): void;
    clear(): void;
    fontFillColor: Color;
    readonly link: URL | null;
    readonly locallyDefinedAttributes: Array<Style.Attribute>;
    readonly namedStyles: Array<NamedStyle>;
}

// NamedStyle

declare class NamedStyle extends Style {
    remove(): void;
    readonly after: NamedStylePosition;
    readonly before: NamedStylePosition;
    readonly identifier: string;
    name: string;
}

// Style.Attribute

declare namespace Style.Attribute {
    const BackgroundColor: Style.Attribute;
    const BaselineOffset: Style.Attribute;
    const BaselineSuperscript: Style.Attribute;
    const Expansion: Style.Attribute;
    const FontCondensed: Style.Attribute;
    const FontFamily: Style.Attribute;
    const FontFillColor: Style.Attribute;
    const FontFixedPitch: Style.Attribute;
    const FontItalic: Style.Attribute;
    const FontName: Style.Attribute;
    const FontNarrow: Style.Attribute;
    const FontSize: Style.Attribute;
    const FontStrokeColor: Style.Attribute;
    const FontStrokeWidth: Style.Attribute;
    const FontWeight: Style.Attribute;
    const KerningAdjustment: Style.Attribute;
    const LigatureSelection: Style.Attribute;
    const Link: Style.Attribute;
    const Obliqueness: Style.Attribute;
    const ParagraphAlignment: Style.Attribute;
    const ParagraphBaseWritingDirection: Style.Attribute;
    const ParagraphDefaultTabInterval: Style.Attribute;
    const ParagraphFirstLineHeadIndent: Style.Attribute;
    const ParagraphHeadIndent: Style.Attribute;
    const ParagraphLineHeightMultiple: Style.Attribute;
    const ParagraphLineSpacing: Style.Attribute;
    const ParagraphMaximumLineHeight: Style.Attribute;
    const ParagraphMinimumLineHeight: Style.Attribute;
    const ParagraphSpacing: Style.Attribute;
    const ParagraphSpacingBefore: Style.Attribute;
    const ParagraphTabStops: Style.Attribute;
    const ParagraphTailIndent: Style.Attribute;
    const ShadowBlurRadius: Style.Attribute;
    const ShadowColor: Style.Attribute;
    const ShadowOffset: Style.Attribute;
    const StrikethroughAffinity: Style.Attribute;
    const StrikethroughColor: Style.Attribute;
    const StrikethroughPattern: Style.Attribute;
    const StrikethroughStyle: Style.Attribute;
    const UnderlineAffinity: Style.Attribute;
    const UnderlineColor: Style.Attribute;
    const UnderlinePattern: Style.Attribute;
    const UnderlineStyle: Style.Attribute;
}

declare namespace Style {
    class Attribute {
        readonly defaultValue: unknown;
        readonly key: string;
    }
}

// Tag.ChildInsertionLocation

declare namespace Tag {
    class ChildInsertionLocation {
    }
}

// Tag.Status

declare namespace Tag.Status {
    const Active: Tag.Status;
    const Dropped: Tag.Status;
    const OnHold: Tag.Status;
    const all: Array<Tag.Status>;
}

declare namespace Tag {
    class Status {
    }
}

// Tag.TaskInsertionLocation

declare namespace Tag {
    class TaskInsertionLocation {
    }
}

// Task.AnchorDateKey

declare namespace Task.AnchorDateKey {
    const DeferDate: Task.AnchorDateKey;
    const DueDate: Task.AnchorDateKey;
    const PlannedDate: Task.AnchorDateKey;
    const all: Array<Task.AnchorDateKey>;
}

declare namespace Task {
    class AnchorDateKey {
    }
}

// Task.ChildInsertionLocation

declare namespace Task {
    class ChildInsertionLocation {
    }
}

// Task.Notification.Kind

declare namespace Task.Notification.Kind {
    const Absolute: Task.Notification.Kind;
    const DueRelative: Task.Notification.Kind;
    const Unknown: Task.Notification.Kind;
    const all: Array<Task.Notification.Kind>;
}

declare namespace Task.Notification {
    class Kind {
    }
}

// Task.RepetitionMethod

declare namespace Task.RepetitionMethod {
    const DeferUntilDate: Task.RepetitionMethod;
    const DueDate: Task.RepetitionMethod;
    const Fixed: Task.RepetitionMethod;
    const None: Task.RepetitionMethod;
    const all: Array<Task.RepetitionMethod>;
}

declare namespace Task {
    class RepetitionMethod {
    }
}

// Task.RepetitionRule

declare namespace Task {
    class RepetitionRule {
        constructor (ruleString: string | null, method: Task.RepetitionMethod | null, scheduleType: Task.RepetitionScheduleType | null, anchorDateKey: Task.AnchorDateKey | null, catchUpAutomatically: boolean | null);
        firstDateAfterDate(date: Date): Date | null;
        readonly anchorDateKey: Task.AnchorDateKey;
        readonly catchUpAutomatically: boolean;
        readonly method: Task.RepetitionMethod;
        readonly ruleString: string;
        readonly scheduleType: Task.RepetitionScheduleType;
    }
}

// Task.RepetitionScheduleType

declare namespace Task.RepetitionScheduleType {
    const FromCompletion: Task.RepetitionScheduleType;
    const None: Task.RepetitionScheduleType;
    const Regularly: Task.RepetitionScheduleType;
    const all: Array<Task.RepetitionScheduleType>;
}

declare namespace Task {
    class RepetitionScheduleType {
    }
}

// Task.Status

declare namespace Task.Status {
    const Available: Task.Status;
    const Blocked: Task.Status;
    const Completed: Task.Status;
    const Dropped: Task.Status;
    const DueSoon: Task.Status;
    const Next: Task.Status;
    const Overdue: Task.Status;
    const all: Array<Task.Status>;
}

declare namespace Task {
    class Status {
    }
}

// Task.TagInsertionLocation

declare namespace Task {
    class TagInsertionLocation {
    }
}

// Text

declare namespace Text {
    function makeFileAttachment(fileWrapper: FileWrapper, style: Style): Text;
}

declare class Text {
    constructor (string: string, style: Style);
    textInRange(range: Text.Range): Text;
    styleForRange(range: Text.Range): Style;
    ranges(component: TextComponent, useEnclosingRange: boolean | null): Array<Text.Range>;
    replace(range: Text.Range, with_: Text): void;
    append(text: Text): void;
    insert(position: Text.Position, text: Text): void;
    remove(range: Text.Range): void;
    find(string: string, options: Array<Text.FindOption> | null, range: Text.Range | null): Text.Range | null;
    readonly attachments: Array<Text>;
    readonly attributeRuns: Array<Text>;
    readonly characters: Array<Text>;
    readonly end: Text.Position;
    readonly fileWrapper: FileWrapper | null;
    readonly paragraphs: Array<Text>;
    readonly range: Text.Range;
    readonly sentences: Array<Text>;
    readonly start: Text.Position;
    string: string;
    readonly style: Style;
    readonly words: Array<Text>;
}

// Text.FindOption

declare namespace Text.FindOption {
    const Anchored: Text.FindOption;
    const Backwards: Text.FindOption;
    const CaseInsensitive: Text.FindOption;
    const DiacriticInsensitive: Text.FindOption;
    const ForcedOrdering: Text.FindOption;
    const Literal: Text.FindOption;
    const Numeric: Text.FindOption;
    const RegularExpression: Text.FindOption;
    const WidthInsensitive: Text.FindOption;
    const all: Array<Text.FindOption>;
}

declare namespace Text {
    class FindOption {
    }
}

// Text.Position

declare namespace Text {
    class Position {
    }
}

// Text.Range

declare namespace Text {
    class Range {
        constructor (start: Text.Position, end: Text.Position);
        readonly end: Text.Position;
        readonly isEmpty: boolean;
        readonly start: Text.Position;
    }
}

// TextAlignment

declare namespace TextAlignment {
    const Center: TextAlignment;
    const Justified: TextAlignment;
    const Left: TextAlignment;
    const Natural: TextAlignment;
    const Right: TextAlignment;
    const all: Array<TextAlignment>;
}

declare class TextAlignment {
}

// TextComponent

declare namespace TextComponent {
    const Attachments: TextComponent;
    const AttributeRuns: TextComponent;
    const Characters: TextComponent;
    const Paragraphs: TextComponent;
    const Sentences: TextComponent;
    const Words: TextComponent;
    const all: Array<TextComponent>;
}

declare class TextComponent {
}

// TimeZone

declare namespace TimeZone {
    const abbreviations: Array<string>;
}

declare class TimeZone {
    constructor (abbreviation: string);
    readonly abbreviation: string | null;
    readonly daylightSavingTime: boolean;
    readonly secondsFromGMT: number;
}

// Timer

declare namespace Timer {
    function once(interval: number, action: (timer: Timer) => void): Timer;
    function repeating(interval: number, action: (timer: Timer) => void): Timer;
}

declare class Timer {
    cancel(): void;
    readonly interval: number;
}

// ToolbarItem

declare class ToolbarItem {
    image: Image | null;
    label: string;
    toolTip: string | null;
}

// Tree

declare class Tree {
    nodeForObject(object: unknown): TreeNode | null;
    nodesForObjects(object: Array<unknown>): Array<TreeNode>;
    reveal(nodes: Array<TreeNode>): void;
    select(nodes: Array<TreeNode>, extending: boolean | null): void;
    copyNodes(nodes: Array<TreeNode>, to: Pasteboard): void;
    paste(from: Pasteboard, parentNode: TreeNode | null, childIndex: number | null): void;
    readonly rootNode: TreeNode;
    readonly selectedNodes: Array<TreeNode>;
}

// ContentTree

declare class ContentTree extends Tree {
}

// SidebarTree

declare class SidebarTree extends Tree {
}

// TreeNode

declare class TreeNode {
    childAtIndex(childIndex: number): TreeNode;
    expand(completely: boolean | null): void;
    collapse(completely: boolean | null): void;
    expandNote(completely: boolean | null): void;
    collapseNote(completely: boolean | null): void;
    reveal(): void;
    apply(f: (node: TreeNode) => ApplyResult | null): ApplyResult | null;
    readonly canCollapse: boolean;
    readonly canExpand: boolean;
    readonly childCount: number;
    readonly children: Array<TreeNode>;
    readonly index: number;
    readonly isExpanded: boolean;
    readonly isNoteExpanded: boolean;
    readonly isRevealed: boolean;
    readonly isRootNode: boolean;
    readonly isSelectable: boolean;
    isSelected: boolean;
    readonly level: number;
    readonly object: unknown;
    readonly parent: TreeNode | null;
    readonly rootNode: TreeNode;
}

// TypeIdentifier

declare namespace TypeIdentifier {
    function fromPathExtension(pathExtension: string, isDirectory: boolean): TypeIdentifier;
    const URL: TypeIdentifier;
    const binaryPropertyList: TypeIdentifier;
    const csv: TypeIdentifier;
    const editableTypes: Array<TypeIdentifier>;
    const gif: TypeIdentifier;
    const image: TypeIdentifier;
    const jpeg: TypeIdentifier;
    const json: TypeIdentifier;
    const ofocus: TypeIdentifier;
    const pdf: TypeIdentifier;
    const plainText: TypeIdentifier;
    const png: TypeIdentifier;
    const propertyList: TypeIdentifier;
    const readableTypes: Array<TypeIdentifier>;
    const rtf: TypeIdentifier;
    const rtfd: TypeIdentifier;
    const taskPaper: TypeIdentifier;
    const tasks: TypeIdentifier;
    const tasksAndFolders: TypeIdentifier;
    const tiff: TypeIdentifier;
    const utf8PlainText: TypeIdentifier;
    const writableTypes: Array<TypeIdentifier>;
    const xmlPropertyList: TypeIdentifier;
}

declare class TypeIdentifier {
    constructor (identifier: string);
    conformsTo(other: TypeIdentifier): boolean;
    readonly displayName: string;
    readonly identifier: string;
    readonly pathExtensions: Array<string>;
}

// URL

declare namespace URL {
    function choose(types: Array<string>): URL | null;
    function chooseFolder(): URL | null;
    function fromString(string: string, relativeToURL: URL | null): URL | null;
    function fromPath(path: string, isDirectory: boolean, relativeToURL: URL | null): URL;
    function tellScript(app: string, js: string, arg: unknown | null): URL | null;
    function tellFunction(app: string, jsFunction: (...args: unknown[]) => unknown, arg: unknown | null): URL | null;
    function omniLink(path: string, folderName: string): URL;
    function resolveFileURLForOmniLink(omniLink: URL, additionalPromptMessage: string | null, additionalQueryItems: Array<URL.QueryItem> | null): Promise<URL>;
    function omniLinkForFileURL(fileURL: URL, additionalQueryItems: Array<URL.QueryItem> | null, additionalPromptMessage: string | null): Promise<URL>;
    const currentAppScheme: string;
    const documentsDirectory: URL;
}

declare class URL {
    fetch(success: (contents: Data) => void, failure: (error: Error) => void | null): void;
    call(success: (...args: unknown[]) => unknown, failure: (...args: unknown[]) => unknown | null): void;
    open(): void;
    find(types: Array<TypeIdentifier>, recurse: boolean | null): Promise<Array<URL>>;
    toString(): string;
    appendingPathComponent(component: string): URL;
    appendingPathExtension(pathExtension: string): URL;
    deletingPathExtension(): URL;
    deletingLastPathComponent(): URL;
    readonly absoluteString: string;
    readonly absoluteURL: URL;
    readonly baseURL: URL | null;
    readonly fragment: string | null;
    readonly hasDirectoryPath: boolean;
    readonly host: string | null;
    readonly isFileURL: boolean;
    readonly lastPathComponent: string;
    readonly password: string | null;
    readonly path: string | null;
    readonly pathComponents: Array<string>;
    readonly pathExtension: string;
    readonly port: number | null;
    readonly query: string | null;
    readonly relativePath: string | null;
    readonly relativeString: string;
    readonly scheme: string | null;
    readonly string: string;
    readonly user: string | null;
}

// URL.Access

declare namespace URL {
    class Access {
        readonly url: URL;
    }
}

// URL.Bookmark

declare namespace URL.Bookmark {
    function fromURL(url: URL): URL.Bookmark;
}

declare namespace URL {
    class Bookmark {
        access(): Promise<URL.Access>;
    }
}

// URL.Components

declare namespace URL.Components {
    function fromString(string: string): URL.Components | null;
    function fromURL(url: URL, resolvingAgainstBaseURL: boolean): URL.Components | null;
}

declare namespace URL {
    class Components {
        constructor ();
        urlRelativeTo(base: URL | null): URL | null;
        fragment: string | null;
        host: string | null;
        password: string | null;
        path: string;
        port: number | null;
        query: string | null;
        queryItems: Array<URL.QueryItem> | null;
        scheme: string | null;
        readonly url: URL | null;
        user: string | null;
    }
}

// URL.FetchRequest

declare namespace URL.FetchRequest {
    function fromString(string: string): URL.FetchRequest | null;
}

declare namespace URL {
    class FetchRequest {
        constructor ();
        fetch(): Promise<URL.FetchResponse>;
        allowsConstrainedNetworkAccess: boolean;
        allowsExpensiveNetworkAccess: boolean;
        bodyData: Data | null;
        bodyString: string | null;
        cache: string | null;
        headers: object;
        httpShouldHandleCookies: boolean;
        httpShouldUsePipelining: boolean;
        method: string | null;
        url: URL | null;
    }
}

// URL.FetchResponse

declare namespace URL {
    class FetchResponse {
        readonly bodyData: Data | null;
        readonly bodyString: string | null;
        readonly headers: object;
        readonly mimeType: string | null;
        readonly statusCode: number;
        readonly textEncodingName: string | null;
        readonly url: URL | null;
    }
}

// URL.QueryItem

declare namespace URL {
    class QueryItem {
        constructor (name: string, value: string | null);
        readonly name: string;
        readonly value: string | null;
    }
}

// UnderlineAffinity

declare namespace UnderlineAffinity {
    const ByWord: UnderlineAffinity;
    const None: UnderlineAffinity;
    const all: Array<UnderlineAffinity>;
}

declare class UnderlineAffinity {
}

// UnderlinePattern

declare namespace UnderlinePattern {
    const Dash: UnderlinePattern;
    const DashDot: UnderlinePattern;
    const DashDotDot: UnderlinePattern;
    const Dot: UnderlinePattern;
    const Solid: UnderlinePattern;
    const all: Array<UnderlinePattern>;
}

declare class UnderlinePattern {
}

// UnderlineStyle

declare namespace UnderlineStyle {
    const Double: UnderlineStyle;
    const None: UnderlineStyle;
    const Single: UnderlineStyle;
    const Thick: UnderlineStyle;
    const all: Array<UnderlineStyle>;
}

declare class UnderlineStyle {
}

// Version

declare class Version {
    constructor (versionString: string);
    equals(version: Version): boolean;
    atLeast(version: Version): boolean;
    isAfter(version: Version): boolean;
    isBefore(version: Version): boolean;
    readonly versionString: string;
}

// Window

declare class Window {
    close(): void;
}

// DocumentWindow

declare class DocumentWindow extends Window {
    selectObjects(objects: Array<DatabaseObject>): void;
    forecastDayForDate(date: Date): ForecastDay;
    selectForecastDays(days: Array<ForecastDay>): void;
    readonly content: ContentTree | null;
    focus: SectionArray | null;
    inspectorVisible: boolean;
    readonly isCompact: boolean;
    readonly isTab: boolean;
    perspective: Perspective.BuiltIn | Perspective.Custom | null;
    readonly selection: Selection;
    readonly sidebar: SidebarTree | null;
    sidebarVisible: boolean;
    readonly tabGroupWindows: Array<DocumentWindow>;
    toolbarVisible: boolean;
}

// XML

declare class XML {
}

// XML.Document

declare namespace XML.Document {
    function fromData(data: Data, whitespaceBehavior: XML.WhitespaceBehavior | null): XML.Document;
}

declare namespace XML {
    class Document {
        constructor (rootElement: string | XML.Element, configuration: XML.Document.Configuration | null);
        xmlData(): Data;
        addElement(name: string, f: () => void | null): void;
        appendString(string: string): void;
        setAttribute(attribute: string, value: string | null): void;
        readonly dtdPublicID: string | null;
        readonly dtdSystemID: URL | null;
        readonly rootElement: XML.Element;
        readonly schemaID: URL | null;
        readonly schemaNamespace: string | null;
        readonly stringEncoding: StringEncoding;
        readonly topElement: XML.Element;
        readonly whitespaceBehavior: XML.WhitespaceBehavior;
    }
}

// XML.Document.Configuration

declare namespace XML.Document {
    class Configuration {
        constructor ();
        dtdPublicID: string | null;
        dtdSystemID: URL | null;
        schemaID: URL | null;
        schemaNamespace: string | null;
        stringEncoding: StringEncoding;
        whitespaceBehavior: XML.WhitespaceBehavior | null;
    }
}

// XML.Element

declare namespace XML {
    class Element {
        constructor (name: string);
        childAtIndex(childIndex: number): string | XML.Element | null;
        insertChild(child: string | XML.Element, childIndex: number): void;
        appendChild(child: string | XML.Element): void;
        removeChildAtIndex(childIndex: number): void;
        removeAllChildren(): void;
        firstChildNamed(name: string): XML.Element | null;
        firstChildAtPath(path: string): XML.Element | null;
        firstChildWithAttribute(attribute: string, value: string): XML.Element | null;
        attributeNamed(name: string): string | null;
        setAttribute(name: string, value: string | null): void;
        apply(f: (node: string | XML.Element) => ApplyResult | null): ApplyResult | null;
        readonly attributeCount: number;
        readonly attributeNames: Array<string>;
        children: Array<string | XML.Element>;
        readonly childrenCount: number;
        readonly lastChild: string | XML.Element | null;
        readonly name: string;
        readonly stringContents: string;
    }
}

// XML.WhitespaceBehavior

declare namespace XML {
    class WhitespaceBehavior {
        constructor (defaultBehavior: XML.WhitespaceBehavior.Type);
        setBehaviorForElementName(behavior: XML.WhitespaceBehavior.Type, elementName: string): void;
        behaviorForElementName(elementName: string): XML.WhitespaceBehavior.Type;
        readonly defaultBehavior: XML.WhitespaceBehavior.Type;
    }
}

// XML.WhitespaceBehavior.Type

declare namespace XML.WhitespaceBehavior.Type {
    const Auto: XML.WhitespaceBehavior.Type;
    const Ignore: XML.WhitespaceBehavior.Type;
    const Preserve: XML.WhitespaceBehavior.Type;
    const all: Array<XML.WhitespaceBehavior.Type>;
}

declare namespace XML.WhitespaceBehavior {
    class Type {
    }
}

