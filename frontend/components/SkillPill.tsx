type SkillPillProps = {
    skill: string;
    matched: boolean;
};

export function SkillPill({ skill, matched }: SkillPillProps) {
    return matched ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {skill}
        </span>
    ) : (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-500">
            {skill}
        </span>
    );
}

type SkillGapProps = {
    techTags: string[];
    profileSkills: string[];
};

export function SkillGapIndicator({ techTags, profileSkills }: SkillGapProps) {
    if (techTags.length === 0) return null;

    const normalizedProfileSkills = profileSkills.map((s) => s.toLowerCase());

    const matchedTags = techTags.filter((tag) =>
        normalizedProfileSkills.includes(tag.toLowerCase()),
    );
    const missingTags = techTags.filter(
        (tag) => !normalizedProfileSkills.includes(tag.toLowerCase()),
    );

    return (
        <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1.5">
                Skills:{" "}
                <span className="text-green-700 font-medium">
                    {matchedTags.length} matched
                </span>
                {missingTags.length > 0 && (
                    <>
                        {" · "}
                        <span className="text-red-500 font-medium">
                            {missingTags.length} missing
                        </span>
                    </>
                )}
            </p>
            <div className="flex flex-wrap gap-1.5">
                {matchedTags.map((tag) => (
                    <SkillPill key={`matched-${tag}`} skill={tag} matched={true} />
                ))}
                {missingTags.map((tag) => (
                    <SkillPill key={`missing-${tag}`} skill={tag} matched={false} />
                ))}
            </div>
        </div>
    );
}
