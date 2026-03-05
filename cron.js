const cron = require('node-cron');
const supabase = require('./supabaseClient');
const pLimit = require('p-limit');
const limit = pLimit(5);

const startCronJobs = () => {
    // Tous les jours à 22h00
    cron.schedule('0 22 * * *', async () => {
        console.log("⏰ Lancement du job de clôture auto...");
        try {
            const { data: enPoste, error } = await supabase
                .from('employees')
                .select('id, employee_type')
                .eq('statut', 'En Poste');

            if (error || !enPoste || enPoste.length === 0) return;

            const tasks = enPoste.map(emp => limit(async () => {
                if (emp.employee_type === 'FIXED' || emp.employee_type === 'SECURITY') return;

                await supabase.from('pointages').insert([{
                    employee_id: emp.id,
                    action: 'CLOCK_OUT',
                    heure: new Date().toISOString(),
                    is_final_out: true,
                    zone_detectee: "AUTO_CLOSURE"
                }]);

                await supabase.from('employees').update({ statut: 'Actif' }).eq('id', emp.id);
                console.log(`✅ Agent ${emp.id} clôturé.`);
            }));

            await Promise.all(tasks);
        } catch (err) { 
            console.error("Erreur Cron :", err); 
        }
    });
};

module.exports = startCronJobs;
