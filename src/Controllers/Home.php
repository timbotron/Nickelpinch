<?php

namespace App\Controllers;

// App pages. Auth (login / signup / password reset / logout) is core's
// Initium\Auth\Controller, mounted in public/index.php.
class Home extends Base {

    public function home_page() {
        $this->view()->addData(['page_title' => SITE_NAME], ['app::basic']);
        echo $this->view()->render('app::home');
    }

    // LOGIN_REDIRECT target. The dashboard island hydrates from the API (E6/F2).
    public function dashboard() {
        $this->require_login();
        $this->view()->addData(['page_title' => SITE_NAME], ['app::basic']);
        $this->view()->addData(['user' => $this->viewer()], ['app::dashboard']);
        echo $this->view()->render('app::dashboard');
    }

    // Manage screen (F3): accounts / categories / budgets CRUD islands over the
    // C1/D1/D2 APIs. The island operates on the session's active budget.
    public function manage() {
        $this->require_login();
        $this->view()->addData(['page_title' => 'Manage · ' . SITE_NAME], ['app::basic']);
        echo $this->view()->render('app::manage');
    }

    // Entry forms (F4): add purchase / move / pay-CC / deposit / withdraw / transfer
    // over the E2–E4 endpoints. The island reads ?type= and ?from= (the dashboard's
    // per-envelope + deep-links here) and acts on the active budget.
    public function entry() {
        $this->require_login();
        $this->view()->addData(['page_title' => 'Add entry · ' . SITE_NAME], ['app::basic']);
        echo $this->view()->render('app::entry');
    }

    // History screen (F5): filtered entry list with detail-expand and delete
    // (reversal), over E7's list endpoint and E5's detail/delete. Reads ?category=,
    // ?type=, ?range= (the dashboard's category names link here).
    public function history() {
        $this->require_login();
        $this->view()->addData(['page_title' => 'History · ' . SITE_NAME], ['app::basic']);
        echo $this->view()->render('app::history');
    }

    // Settings screen (F7): user preferences (theme, default view, default payment
    // account) over E8. Budget currency stays on the budget (Manage → Budgets).
    public function settings() {
        $this->require_login();
        $this->view()->addData(['page_title' => 'Settings · ' . SITE_NAME], ['app::basic']);
        echo $this->view()->render('app::settings');
    }

    // Reports screen (CODE-235): spend charts over the Report aggregation endpoints —
    // time-series via Lightweight Charts, the monthly breakdown via SVG bars.
    public function reports() {
        $this->require_login();
        $this->view()->addData(['page_title' => 'Reports · ' . SITE_NAME], ['app::basic']);
        echo $this->view()->render('app::reports');
    }
}
