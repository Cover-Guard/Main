const team = [
  {
    name: 'Jordan Mitchell',
    role: 'CEO & Co-Founder',
    bio: 'Former VP of Product at a top insurtech. 15 years in property insurance and risk modeling.',
    initials: 'JM',
    color: 'bg-brand-600',
  },
  {
    name: 'Priya Sharma',
    role: 'CTO & Co-Founder',
    bio: 'Ex-Google engineer. Built large-scale geospatial data platforms for climate risk analysis.',
    initials: 'PS',
    color: 'bg-teal-600',
  },
  {
    name: 'Marcus Chen',
    role: 'Head of Data Science',
    bio: 'PhD in geophysics. Previously led risk modeling at a major reinsurance firm.',
    initials: 'MC',
    color: 'bg-indigo-600',
  },
  {
    name: 'Sarah Okafor',
    role: 'VP of Partnerships',
    bio: '10+ years building carrier relationships. Deep network across P&C insurance markets.',
    initials: 'SO',
    color: 'bg-rose-600',
  },
  {
    name: 'David Park',
    role: 'Head of Engineering',
    bio: 'Full-stack leader with experience scaling real-time data platforms at Series B+ startups.',
    initials: 'DP',
    color: 'bg-amber-600',
  },
  {
    name: 'Elena Rodriguez',
    role: 'VP of Product',
    bio: 'Product leader focused on agent workflows. Former product at Zillow and Opendoor.',
    initials: 'ER',
    color: 'bg-purple-600',
  },
]

export function TeamSection() {
  return (
    <section id="team" className="py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">Team</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
            Built by insurance and data experts
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Our team combines deep domain expertise in property insurance, geospatial data science,
            and enterprise software to build the platform the industry has been missing.
          </p>
        </div>

        {/* Team grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {team.map((member) => (
            <div
              key={member.name}
              className="rounded-2xl border border-gray-200 p-6 hover:border-brand-200 hover:shadow-md transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${member.color} text-white font-bold text-lg`}
                >
                  {member.initials}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{member.name}</h3>
                  <p className="text-sm text-brand-600 font-medium">{member.role}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-600 leading-relaxed">{member.bio}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
